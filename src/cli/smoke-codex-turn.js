import { CodexAppServerProcess } from "../codex/app-server-process.js";
import { RuntimeTask } from "../runtime/runtime-task.js";

const DEFAULT_PROMPT = "Summarize this repository in one short paragraph.";

export function parseSmokeArgs(args, { cwd = process.cwd() } = {}) {
  const parsed = {
    help: false,
    prompt: DEFAULT_PROMPT,
    cwd,
    model: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--prompt") {
      parsed.prompt = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--cwd") {
      parsed.cwd = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--model") {
      parsed.model = readValue(args, index, arg);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

export function smokeHelp() {
  return [
    "Usage: npm run smoke:codex -- [--prompt <text>] [--cwd <path>] [--model <model>]",
    "",
    "Starts local codex app-server over stdio, creates a thread, starts one turn,",
    "prints streamed summaries, and exits after turn/completed.",
  ].join("\n");
}

export async function runSmokeCodexTurn({
  prompt = DEFAULT_PROMPT,
  cwd = process.cwd(),
  model = null,
  codexBin = "codex",
  output = process.stdout,
  errorOutput = process.stderr,
  appServerFactory = (options) => new CodexAppServerProcess(options),
  turnTimeoutMs = 900_000,
} = {}) {
  const task = new RuntimeTask({
    taskId: `smoke_${Date.now()}`,
    cwd,
  });

  let finishTurn;
  let failTurn;
  const turnCompleted = new Promise((resolve, reject) => {
    finishTurn = resolve;
    failTurn = reject;
  });

  const appServer = appServerFactory({
    codexBin,
    onEvent: (event) => {
      task.handleCodexEvent(event);
      const snapshot = task.snapshot();

      if (event.method === "turn/completed") {
        finishTurn();
      }

      if (event.method === "item/agentMessage/delta") {
        return;
      }
      output.write(`[${snapshot.status}] ${snapshot.summaryText}\n`);
    },
    onStderr: (line) => errorOutput.write(`[codex] ${line}\n`),
    onProtocolError: (error) => {
      errorOutput.write(`[protocol] ${error.message}\n`);
      failTurn(error);
    },
  });

  const session = await appServer.start();
  const threadResult = await session.startThread(model ? { model } : {});
  const threadId = threadResult.thread.id;
  task.attachThread(threadId);

  const turnResult = await session.startTurn({ threadId, text: prompt, cwd });
  if (turnResult.turn?.id && task.snapshot().status === "queued") {
    task.handleCodexEvent({
      method: "turn/started",
      params: { turn: { id: turnResult.turn.id } },
    });
  }

  await withTimeout(turnCompleted, turnTimeoutMs);
  return task;
}

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }

  return value;
}

function withTimeout(promise, timeoutMs) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Timed out waiting for Codex turn completion"));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timeoutId);
  });
}
