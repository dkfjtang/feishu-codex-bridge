import {
  parseMessageReceiveEvent,
  UnsupportedFeishuEventError,
} from "./message-event-parser.js";

export class FeishuEventHandler {
  #runtime;

  constructor({ runtime }) {
    this.#runtime = runtime;
  }

  async handleMessageReceive(payload) {
    let message;
    try {
      message = parseMessageReceiveEvent(payload);
    } catch (error) {
      if (error instanceof UnsupportedFeishuEventError) {
        return { status: "skipped", reason: error.message };
      }
      throw error;
    }

    const task = await this.#runtime.handleTextMessage(message);
    return {
      status: "handled",
      taskStatus: task.snapshot().status,
    };
  }
}
