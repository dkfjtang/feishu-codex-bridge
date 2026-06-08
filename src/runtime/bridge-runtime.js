import { RuntimeTask } from "./runtime-task.js";

export class BridgeRuntime {
  #policy;
  #threadStore;
  #session;
  #cardController;

  constructor({ policy, threadStore, session, cardController }) {
    this.#policy = policy;
    this.#threadStore = threadStore;
    this.#session = session;
    this.#cardController = cardController;
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

    const turnResult = await this.#session.startTurn({ threadId, text, cwd });
    if (turnResult.turn?.id) {
      task.handleCodexEvent({
        method: "turn/started",
        params: { turn: { id: turnResult.turn.id } },
      });
    }

    task.handleCodexEvent({
      method: "turn/completed",
      params: { status: "success" },
    });

    await this.#threadStore.saveThread({
      openId,
      cwd,
      threadId,
      lastTurnId: task.snapshot().turnId,
    });
    await this.#cardController.sync(task);

    return task;
  }
}
