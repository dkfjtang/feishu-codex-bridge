import { CodexAppServerProcess } from "../codex/app-server-process.js";

export function parseCheckCodexArgs(args) {
  const parsed = {
    help: false,
    codexBin: "codex",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--codex-bin") {
      parsed.codexBin = readValue(args, index, arg);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

export function checkCodexHelp() {
  return [
    "Usage: npm run check-codex-app-server -- [--codex-bin <path>]",
    "",
    "Starts local codex app-server over stdio and verifies initialize completes.",
  ].join("\n");
}

export async function runCheckCodexAppServer({
  codexBin = "codex",
  output = process.stdout,
  errorOutput = process.stderr,
  appServerFactory = (options) => new CodexAppServerProcess(options),
} = {}) {
  const appServer = appServerFactory({ codexBin });

  try {
    await appServer.start();
    output.write("Codex app-server check passed.\n");
    output.write(`codexBin: ${codexBin}\n`);
    if (typeof appServer.isAvailable === "function") {
      output.write(`available: ${appServer.isAvailable() ? "yes" : "no"}\n`);
    }
    return 0;
  } catch (error) {
    errorOutput.write(`Codex app-server check failed: ${error.message}\n`);
    return 1;
  } finally {
    if (typeof appServer.stop === "function") {
      appServer.stop();
    }
  }
}

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }

  return value;
}
