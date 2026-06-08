export class UnsupportedFeishuEventError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnsupportedFeishuEventError";
  }
}

export function parseMessageReceiveEvent(payload) {
  const event = payload?.event;
  const message = event?.message;

  if (message?.chat_type !== "p2p") {
    throw new UnsupportedFeishuEventError("Only private chat messages are supported in MVP");
  }

  if (message?.message_type !== "text") {
    throw new UnsupportedFeishuEventError("Only text messages are supported");
  }

  const content = parseContent(message.content);
  const text = content.text?.trim();
  if (!text) {
    throw new UnsupportedFeishuEventError("Text message is empty");
  }

  return {
    messageId: message.message_id,
    openId: event?.sender?.sender_id?.open_id,
    chatId: message.chat_id,
    text,
  };
}

function parseContent(rawContent) {
  try {
    return JSON.parse(rawContent);
  } catch (cause) {
    throw new UnsupportedFeishuEventError("Invalid Feishu message content JSON", {
      cause,
    });
  }
}
