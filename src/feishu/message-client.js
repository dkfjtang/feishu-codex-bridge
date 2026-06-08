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
    const response = await callFeishuAction("send", () =>
      this.#transport.sendMessage({
        receiveIdType: action.receiveIdType,
        receiveId: action.receiveId,
        msgType: action.messageType,
        content: JSON.stringify(action.card),
      }),
    );

    return {
      messageId: response?.data?.message_id ?? null,
    };
  }

  async #updateCard(action) {
    await callFeishuAction("update", () =>
      this.#transport.patchMessageCard({
        messageId: action.messageId,
        card: action.card,
      }),
    );

    return {};
  }
}

export class FeishuApiError extends Error {
  constructor({ actionType, code = null, message, cause = null }) {
    super(`Feishu ${actionType} failed${code ? ` (${code})` : ""}: ${message}`, { cause });
    this.name = "FeishuApiError";
    this.actionType = actionType;
    this.code = code;
  }
}

async function callFeishuAction(actionType, action) {
  try {
    const response = await action();
    if (response?.code && response.code !== 0) {
      throw new FeishuApiError({
        actionType,
        code: response.code,
        message: response.msg || "Feishu API returned an error",
      });
    }

    return response;
  } catch (error) {
    if (error instanceof FeishuApiError) {
      throw error;
    }

    throw new FeishuApiError({
      actionType,
      message: error instanceof Error ? error.message : String(error),
      cause: error,
    });
  }
}
