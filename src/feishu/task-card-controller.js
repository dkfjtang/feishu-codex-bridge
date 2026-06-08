import { buildTaskCardAction } from "./task-card-actions.js";

export class TaskCardController {
  #sendAction;

  constructor({ sendAction }) {
    if (typeof sendAction !== "function") {
      throw new TypeError("TaskCardController requires a sendAction function");
    }

    this.#sendAction = sendAction;
  }

  async sync(task) {
    const action = buildTaskCardAction(task.snapshot());
    const result = await this.#sendAction(action);

    if (action.type === "send" && result?.messageId) {
      task.attachCard(result.messageId);
    }

    return result;
  }
}
