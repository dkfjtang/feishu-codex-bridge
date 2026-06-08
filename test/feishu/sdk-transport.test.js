import assert from "node:assert/strict";
import { test } from "node:test";

import { FeishuSdkTransport } from "../../src/feishu/sdk-transport.js";

test("sendMessage calls Feishu SDK im.message.create", async () => {
  const calls = [];
  const transport = new FeishuSdkTransport({
    appId: "cli_123",
    appSecret: "secret",
    createClient: () => ({
      im: {
        message: {
          create: async (payload) => {
            calls.push(payload);
            return { data: { message_id: "om_123" } };
          },
        },
      },
    }),
  });

  const result = await transport.sendMessage({
    receiveIdType: "chat_id",
    receiveId: "oc_123",
    msgType: "interactive",
    content: "{\"config\":{}}",
  });

  assert.deepEqual(calls, [
    {
      params: { receive_id_type: "chat_id" },
      data: {
        receive_id: "oc_123",
        msg_type: "interactive",
        content: "{\"config\":{}}",
      },
    },
  ]);
  assert.deepEqual(result, { data: { message_id: "om_123" } });
});

test("patchMessageCard calls Feishu SDK im.message.patch with stringified card", async () => {
  const calls = [];
  const transport = new FeishuSdkTransport({
    appId: "cli_123",
    appSecret: "secret",
    createClient: () => ({
      im: {
        message: {
          patch: async (payload) => {
            calls.push(payload);
            return { data: {} };
          },
        },
      },
    }),
  });

  const result = await transport.patchMessageCard({
    messageId: "om_123",
    card: { config: { update_multi: true } },
  });

  assert.deepEqual(calls, [
    {
      path: { message_id: "om_123" },
      data: {
        content: JSON.stringify({ config: { update_multi: true } }),
      },
    },
  ]);
  assert.deepEqual(result, { data: {} });
});

test("probeBot returns bot open id and name from Feishu ping API", async () => {
  const transport = new FeishuSdkTransport({
    appId: "cli_123",
    appSecret: "secret",
    createClient: () => ({
      request: async (payload) => {
        assert.deepEqual(payload, {
          method: "POST",
          url: "/open-apis/bot/v1/openclaw_bot/ping",
          data: { needBotInfo: true },
        });
        return {
          code: 0,
          data: {
            pingBotInfo: {
              botID: "ou_bot",
              botName: "Codex",
            },
          },
        };
      },
    }),
  });

  assert.deepEqual(await transport.probeBot(), {
    ok: true,
    appId: "cli_123",
    botOpenId: "ou_bot",
    botName: "Codex",
  });
});

test("constructor requires app credentials", () => {
  assert.throws(
    () =>
      new FeishuSdkTransport({
        appId: "",
        appSecret: "secret",
        createClient: () => ({}),
      }),
    /FeishuSdkTransport requires FEISHU_APP_ID and FEISHU_APP_SECRET/,
  );
});
