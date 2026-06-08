import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseMessageReceiveEvent,
  UnsupportedFeishuEventError,
} from "../../src/feishu/message-event-parser.js";

test("parseMessageReceiveEvent extracts private text message context", () => {
  const result = parseMessageReceiveEvent({
    event: {
      sender: {
        sender_id: { open_id: "ou_123" },
      },
      message: {
        message_id: "om_123",
        chat_id: "oc_123",
        chat_type: "p2p",
        message_type: "text",
        content: JSON.stringify({ text: "帮我看项目状态" }),
      },
    },
  });

  assert.deepEqual(result, {
    messageId: "om_123",
    openId: "ou_123",
    chatId: "oc_123",
    text: "帮我看项目状态",
  });
});

test("parseMessageReceiveEvent rejects group messages for MVP", () => {
  assert.throws(
    () =>
      parseMessageReceiveEvent({
        event: {
          sender: { sender_id: { open_id: "ou_123" } },
          message: {
            message_id: "om_123",
            chat_id: "oc_123",
            chat_type: "group",
            message_type: "text",
            content: JSON.stringify({ text: "hello" }),
          },
        },
      }),
    UnsupportedFeishuEventError,
  );
});

test("parseMessageReceiveEvent rejects non-text messages", () => {
  assert.throws(
    () =>
      parseMessageReceiveEvent({
        event: {
          sender: { sender_id: { open_id: "ou_123" } },
          message: {
            message_id: "om_123",
            chat_id: "oc_123",
            chat_type: "p2p",
            message_type: "image",
            content: "{}",
          },
        },
      }),
    /Only text messages are supported/,
  );
});

test("parseMessageReceiveEvent rejects empty text", () => {
  assert.throws(
    () =>
      parseMessageReceiveEvent({
        event: {
          sender: { sender_id: { open_id: "ou_123" } },
          message: {
            message_id: "om_123",
            chat_id: "oc_123",
            chat_type: "p2p",
            message_type: "text",
            content: JSON.stringify({ text: "  " }),
          },
        },
      }),
    /Text message is empty/,
  );
});

test("parseMessageReceiveEvent rejects invalid content JSON", () => {
  assert.throws(
    () =>
      parseMessageReceiveEvent({
        event: {
          sender: { sender_id: { open_id: "ou_123" } },
          message: {
            message_id: "om_123",
            chat_id: "oc_123",
            chat_type: "p2p",
            message_type: "text",
            content: "not-json",
          },
        },
      }),
    /Invalid Feishu message content JSON/,
  );
});
