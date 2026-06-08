import { createBridgeApp } from "../app/create-bridge-app.js";
import { FeishuSdkTransport } from "../feishu/sdk-transport.js";

export async function runDev({
  env = process.env,
  output = process.stdout,
  errorOutput = process.stderr,
  transportFactory = (options) => new FeishuSdkTransport(options),
  appFactory = createBridgeApp,
} = {}) {
  if (!env.FEISHU_APP_ID || !env.FEISHU_APP_SECRET) {
    errorOutput.write(
      "Feishu credentials are not configured. Set FEISHU_APP_ID and FEISHU_APP_SECRET before starting the real bridge.\n",
    );
    return 1;
  }

  const feishuTransport = transportFactory({
    appId: env.FEISHU_APP_ID,
    appSecret: env.FEISHU_APP_SECRET,
  });
  const probe = await feishuTransport.probeBot();
  if (!probe.ok) {
    errorOutput.write(`Feishu bot probe failed: ${probe.error}\n`);
    return 1;
  }

  const app = appFactory({
    env,
    feishuTransport,
    botOpenId: probe.botOpenId ?? null,
  });

  output.write(`Starting fca for cwd ${app.config.defaultWorkdir}\n`);
  if (probe.botOpenId) {
    output.write(`Feishu bot ${probe.botName ?? "unknown"} (${probe.botOpenId}) detected.\n`);
  }
  await app.start();
  output.write("fca bridge app started. Feishu long-connection transport is pending.\n");
  return 0;
}
