import assert from "node:assert/strict";
import { test } from "node:test";

import { runDev } from "../../src/cli/dev.js";

test("runDev returns a clear error when Feishu credentials are missing", async () => {
  let errorText = "";
  const exitCode = await runDev({
    env: {},
    output: { write: () => {} },
    errorOutput: { write: (text) => (errorText += text) },
  });

  assert.equal(exitCode, 1);
  assert.match(errorText, /FEISHU_APP_ID and FEISHU_APP_SECRET/);
});

test("runDev creates sdk transport, probes bot identity, and starts bridge app", async () => {
  const calls = [];
  let outputText = "";
  const transport = {
    probeBot: async () => ({
      ok: true,
      botOpenId: "ou_bot",
      botName: "Codex",
    }),
    startMessageListener: async ({ onMessageReceive }) => {
      calls.push({ type: "listen", onMessageReceive });
    },
  };

  const exitCode = await runDev({
    env: {
      FEISHU_APP_ID: "cli_123",
      FEISHU_APP_SECRET: "secret",
    },
    output: { write: (text) => (outputText += text) },
    errorOutput: { write: () => {} },
    transportFactory: (options) => {
      calls.push({ type: "transport", options });
      return transport;
    },
    appFactory: (options) => {
      calls.push({ type: "app", options });
      return {
        config: { defaultWorkdir: "F:\\development\\f-codex" },
        start: async () => {
          calls.push({ type: "start" });
        },
      };
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(calls[0].type, "transport");
  assert.deepEqual(calls[0].options, {
    appId: "cli_123",
    appSecret: "secret",
    verificationToken: "",
    encryptKey: "",
  });
  assert.equal(calls[1].type, "app");
  assert.deepEqual(calls[1].options.env, {
    FEISHU_APP_ID: "cli_123",
    FEISHU_APP_SECRET: "secret",
  });
  assert.equal(calls[1].options.feishuTransport, transport);
  assert.equal(calls[1].options.botOpenId, "ou_bot");
  assert.deepEqual(calls[2], { type: "start" });
  assert.equal(calls[3].type, "listen");
  assert.equal(typeof calls[3].onMessageReceive, "function");
  assert.match(outputText, /bot Codex \(ou_bot\)/);
});
