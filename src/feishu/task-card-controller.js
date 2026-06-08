import { buildTaskCardAction } from "./task-card-actions.js";

export class TaskCardController {
  #sendAction;
  #syncQueue = Promise.resolve();

  constructor({ sendAction }) {
    if (typeof sendAction !== "function") {
      throw new TypeError("TaskCardController requires a sendAction function");
    }

    this.#sendAction = sendAction;
  }

  async sync(task) {
    const syncOperation = this.#syncQueue.then(() => this.#syncNow(task));
    this.#syncQueue = syncOperation.catch(() => {});
    return syncOperation;
  }

  async #syncNow(task) {
    const action = buildTaskCardAction(task.snapshot());
    const result = await this.#sendAction(action);

    if (action.type === "send" && result?.messageId) {
      task.attachCard(result.messageId);
    }

    return result;
  }
}
