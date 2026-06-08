export class FeishuMessageClient {
  #transport;

  constructor({ transport }) {
    this.#transport = transport;
  }

  async sendAction(action) {
    if (action.type === "send") {
      return this.#sendCard(action);
    }

    if (action.type === "update") {
      return this.#updateCard(action);
    }

    throw new Error(`Unsupported Feishu action type: ${action.type}`);
  }

  async #sendCard(action) {
    const response = await this.#transport.sendMessage({
      receiveIdType: action.receiveIdType,
      receiveId: action.receiveId,
      msgType: action.messageType,
      content: JSON.stringify(action.card),
    });

    return {
      messageId: response?.data?.message_id ?? null,
    };
  }

  async #updateCard(action) {
    await this.#transport.patchMessageCard({
      messageId: action.messageId,
      card: action.card,
    });

    return {};
  }
}
