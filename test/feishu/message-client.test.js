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

test("sendAction normalizes Feishu API error responses", async () => {
  const client = new FeishuMessageClient({
    transport: {
      sendMessage: async () => ({
        code: 99991663,
        msg: "frequency limited",
      }),
    },
  });

  await assert.rejects(
    () =>
      client.sendAction({
        type: "send",
        receiveIdType: "chat_id",
        receiveId: "oc_123",
        messageType: "interactive",
        card: { config: {} },
      }),
    (error) => {
      assert.equal(error.name, "FeishuApiError");
      assert.equal(error.code, 99991663);
      assert.equal(error.actionType, "send");
      assert.match(error.message, /Feishu send failed/);
      assert.match(error.message, /99991663/);
      assert.match(error.message, /frequency limited/);
      return true;
    },
  );
});

test("sendAction normalizes thrown transport errors", async () => {
  const client = new FeishuMessageClient({
    transport: {
      patchMessageCard: async () => {
        throw new Error("network reset");
      },
    },
  });

  await assert.rejects(
    () =>
      client.sendAction({
        type: "update",
        messageId: "om_123",
        card: { config: {} },
      }),
    (error) => {
      assert.equal(error.name, "FeishuApiError");
      assert.equal(error.actionType, "update");
      assert.equal(error.cause.message, "network reset");
      assert.match(error.message, /Feishu update failed/);
      assert.match(error.message, /network reset/);
      return true;
    },
  );
});
