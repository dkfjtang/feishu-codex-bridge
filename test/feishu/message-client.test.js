import assert from "node:assert/strict";
import { test } from "node:test";

import { FeishuMessageClient } from "../../src/feishu/message-client.js";

test("sendAction sends an interactive card message", async () => {
  const calls = [];
  const client = new FeishuMessageClient({
    transport: {
      sendMessage: async (payload) => {
        calls.push({ method: "sendMessage", payload });
        return { data: { message_id: "om_123" } };
      },
    },
  });

  const result = await client.sendAction({
    type: "send",
    receiveIdType: "chat_id",
    receiveId: "oc_123",
    messageType: "interactive",
    card: { header: { title: { content: "任务已接收" } } },
  });

  assert.deepEqual(calls, [
    {
      method: "sendMessage",
      payload: {
        receiveIdType: "chat_id",
        receiveId: "oc_123",
        msgType: "interactive",
        content: JSON.stringify({ header: { title: { content: "任务已接收" } } }),
      },
    },
  ]);
  assert.deepEqual(result, { messageId: "om_123" });
});

test("sendAction updates an existing card message", async () => {
  const calls = [];
  const client = new FeishuMessageClient({
    transport: {
      patchMessageCard: async (payload) => {
        calls.push({ method: "patchMessageCard", payload });
        return { data: {} };
      },
    },
  });

  const result = await client.sendAction({
    type: "update",
    messageId: "om_123",
    card: { header: { title: { content: "Codex 执行中" } } },
  });

  assert.deepEqual(calls, [
    {
      method: "patchMessageCard",
      payload: {
        messageId: "om_123",
        card: { header: { title: { content: "Codex 执行中" } } },
      },
    },
  ]);
  assert.deepEqual(result, {});
});

test("sendAction rejects unsupported action type", async () => {
  const client = new FeishuMessageClient({
    transport: {},
  });

  await assert.rejects(
    () => client.sendAction({ type: "delete" }),
    /Unsupported Feishu action type: delete/,
  );
});
