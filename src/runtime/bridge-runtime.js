import { RuntimeTask } from "./runtime-task.js";

export class BridgeRuntime {
  #policy;
  #threadStore;
  #session;
  #cardController;
  #now;
  #setTimeout;
  #clearTimeout;
  #runningUpdateThrottleMs;

  constructor({
    policy,
    threadStore,
    session,
    cardController,
    turnTimeoutMs = 900_000,
    runningUpdateThrottleMs = 3000,
    now = () => Date.now(),
    setTimeoutFn = (callback, delay) => setTimeout(callback, delay),
    clearTimeoutFn = (timer) => clearTimeout(timer),
  }) {
    this.#policy = policy;
    this.#threadStore = threadStore;
    this.#session = session;
    this.#cardController = cardController;
    this.turnTimeoutMs = turnTimeoutMs;
    this.#runningUpdateThrottleMs = runningUpdateThrottleMs;
    this.#now = now;
    this.#setTimeout = setTimeoutFn;
    this.#clearTimeout = clearTimeoutFn;
  }

  async handleTextMessage({ messageId, openId, chatId, text }) {
    if (!this.#policy.canUseOpenId(openId)) {
      throw new Error("Feishu user is not allowed");
    }

    const cwd = this.#policy.defaultWorkdir();
    if (!this.#policy.canUseWorkdir(cwd)) {
      throw new Error("Default workdir is not allowed");
    }

    const task = new RuntimeTask({
      taskId: messageId,
      feishuMessageId: messageId,
      feishuOpenId: openId,
      feishuChatId: chatId,
      cwd,
    });

    await this.#cardController.sync(task);

    const mapping = await this.#threadStore.getThread({ openId, cwd });
    let threadId = mapping?.threadId;

    if (!threadId) {
      const threadResult = await this.#session.startThread({});
      threadId = threadResult.thread.id;
      task.attachThread(threadId);
    } else {
      task.attachThread(threadId);
    }

    const runningUpdates = this.#createRunningUpdateScheduler(task);
    const turnCompleted = this.#waitForTurnCompletion(task, runningUpdates);
    const turnResult = await this.#session.startTurn({ threadId, text, cwd });
    if (turnResult.turn?.id) {
      task.handleCodexEvent({
        method: "turn/started",
        params: { turn: { id: turnResult.turn.id } },
      });
    }

    try {
      await turnCompleted;
    } finally {
      runningUpdates.cancel();
    }

    await this.#threadStore.saveThread({
      openId,
      cwd,
      threadId,
      lastTurnId: task.snapshot().turnId,
    });
    await this.#cardController.sync(task);

    return task;
  }

  #waitForTurnCompletion(task, runningUpdates) {
    let unsubscribe = () => {};
    let timeoutId;

    const completed = new Promise((resolve, reject) => {
      unsubscribe = this.#session.onEvent((event) => {
        task.handleCodexEvent(event);
        if (event.method === "item/agentMessage/delta") {
          runningUpdates.schedule();
        }
        if (event.method === "turn/completed") {
          resolve();
        }
      });

      timeoutId = setTimeout(() => {
        reject(new Error("Timed out waiting for Codex turn completion"));
      }, this.turnTimeoutMs);
    });

    return completed.finally(() => {
      clearTimeout(timeoutId);
      unsubscribe();
    });
  }

  #createRunningUpdateScheduler(task) {
    let timer = null;
    let lastSyncAt = this.#now();

    const syncRunning = async () => {
      timer = null;
      lastSyncAt = this.#now();
      if (task.snapshot().status === "running") {
        try {
          await this.#cardController.sync(task);
        } catch {
          // Running updates are best-effort; final sync still reports terminal state.
        }
      }
    };

    return {
      schedule: () => {
        if (timer) {
          return;
        }

        const elapsed = this.#now() - lastSyncAt;
        const delay = Math.max(this.#runningUpdateThrottleMs - elapsed, 0);
        timer = this.#setTimeout(syncRunning, delay);
      },
      cancel: () => {
        if (timer) {
          this.#clearTimeout(timer);
          timer = null;
        }
      },
    };
  }
}
