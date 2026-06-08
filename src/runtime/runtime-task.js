import { TurnOutputBuffer } from "../codex/turn-output-buffer.js";

export class RuntimeTask {
  #taskId;
  #feishuMessageId;
  #feishuOpenId;
  #feishuChatId;
  #feishuChatType;
  #cardMessageId = null;
  #threadId = null;
  #turnId = null;
  #cwd;
  #model;
  #appVersion;
  #now;
  #startedAt;
  #completedAt = null;
  #status = "queued";
  #errorSummary = null;
  #errorType = null;
  #tokenUsage = null;
  #currentStage = null;
  #lastStage = null;
  #output;

  constructor({
    taskId,
    feishuMessageId = null,
    feishuOpenId = null,
    feishuChatId = null,
    feishuChatType = null,
    cwd = null,
    model = null,
    appVersion = null,
    now = () => Date.now(),
    summaryLimit,
  }) {
    this.#taskId = taskId;
    this.#feishuMessageId = feishuMessageId;
    this.#feishuOpenId = feishuOpenId;
    this.#feishuChatId = feishuChatId;
    this.#feishuChatType = feishuChatType;
    this.#cwd = cwd;
    this.#model = model;
    this.#appVersion = appVersion;
    this.#now = now;
    this.#startedAt = this.#now();
    this.#output = new TurnOutputBuffer({ summaryLimit });
  }

  attachThread(threadId) {
    this.#threadId = threadId;
  }

  attachCard(cardMessageId) {
    this.#cardMessageId = cardMessageId;
  }

  cancel(reason = "任务已取消") {
    this.#status = "cancelled";
    this.#errorSummary = reason;
    this.#errorType = "cancelled";
    this.#completedAt = this.#now();
  }

  handleCodexEvent(event) {
    if (this.#status === "cancelled") {
      return;
    }

    switch (event.method) {
      case "turn/started":
        this.#turnId = event.params?.turn?.id ?? this.#turnId;
        if (this.#status === "queued") {
          this.#status = "running";
        }
        break;
      case "item/started":
        this.#handleItemStarted(event.params);
        break;
      case "item/agentMessage/delta":
        this.#output.appendDelta(event.params?.delta);
        break;
      case "item/completed":
        this.#handleItemCompleted(event.params);
        break;
      case "turn/completed":
        this.#handleTurnCompleted(event.params);
        break;
      case "thread/tokenUsage/updated":
        this.#handleTokenUsageUpdated(event.params);
        break;
      default:
        break;
    }
  }

  snapshot() {
    return {
      taskId: this.#taskId,
      feishuMessageId: this.#feishuMessageId,
      feishuOpenId: this.#feishuOpenId,
      feishuChatId: this.#feishuChatId,
      feishuChatType: this.#feishuChatType,
      cardMessageId: this.#cardMessageId,
      threadId: this.#threadId,
      turnId: this.#turnId,
      cwd: this.#cwd,
      model: this.#model,
      appVersion: this.#appVersion,
      status: this.#status,
      startedAt: this.#startedAt,
      completedAt: this.#completedAt,
      elapsedMs: this.#elapsedMs(),
      summaryText: this.#output.summaryText(),
      finalText: this.#output.finalText(),
      errorSummary: this.#errorSummary,
      errorType: this.#errorType,
      tokenUsage: this.#tokenUsage,
      currentStage: this.#currentStage,
      lastStage: this.#lastStage,
    };
  }

  #handleItemStarted(params = {}) {
    if (params.threadId) {
      this.#threadId = params.threadId;
    }
    if (params.turnId) {
      this.#turnId = params.turnId;
    }
    if (this.#status === "queued") {
      this.#status = "running";
    }

    this.#currentStage = stageFromItem(params.item, "running");
  }

  #handleItemCompleted(params = {}) {
    if (params.threadId) {
      this.#threadId = params.threadId;
    }
    if (params.turnId) {
      this.#turnId = params.turnId;
    }

    const completedStage = stageFromItem(params.item, "completed");
    this.#lastStage = completedStage;
    if (!this.#currentStage || this.#currentStage.id === completedStage.id) {
      this.#currentStage = null;
    }
  }

  #handleTokenUsageUpdated(params = {}) {
    if (params.threadId) {
      this.#threadId = params.threadId;
    }
    if (params.turnId) {
      this.#turnId = params.turnId;
    }
    if (params.tokenUsage) {
      this.#tokenUsage = params.tokenUsage;
    }
  }

  #handleTurnCompleted(params = {}) {
    this.#completedAt = this.#now();
    if (params.status === "failed" || params.error) {
      this.#status = "failed";
      this.#errorSummary = params.error?.message ?? "Codex turn failed";
      this.#errorType = params.error?.type ?? params.status ?? "failed";
      return;
    }

    this.#status = "completed";
  }

  #elapsedMs() {
    return (this.#completedAt ?? this.#now()) - this.#startedAt;
  }
}

function stageFromItem(item = {}, status) {
  return {
    id: item.id ?? null,
    type: item.type ?? "unknown",
    status: item.status ?? status,
    label: stageLabel(item),
  };
}

function stageLabel(item = {}) {
  switch (item.type) {
    case "agentMessage":
      return "生成回复";
    case "plan":
      return "更新计划";
    case "reasoning":
      return "推理分析";
    case "commandExecution":
      return "执行命令";
    case "fileChange":
      return "处理文件变更";
    case "mcpToolCall":
      return item.tool ? `调用 MCP 工具 ${item.tool}` : "调用 MCP 工具";
    case "dynamicToolCall":
      return item.tool ? `调用工具 ${item.tool}` : "调用工具";
    case "webSearch":
      return "检索网页";
    case "imageView":
      return "查看图片";
    case "imageGeneration":
      return "生成图片";
    case "contextCompaction":
      return "压缩上下文";
    case "collabAgentToolCall":
      return "协作智能体任务";
    case "userMessage":
    case "hookPrompt":
      return "读取输入";
    default:
      return "处理阶段";
  }
}
