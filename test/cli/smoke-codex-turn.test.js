import assert from "node:assert/strict";
import { test } from "node:test";

import { parseSmokeArgs, runSmokeCodexTurn } from "../../src/cli/smoke-codex-turn.js";

test("parseSmokeArgs uses a safe default prompt", () => {
  assert.deepEqual(parseSmokeArgs([]), {
    help: false,
    prompt: "Summarize this repository in one short paragraph.",
    cwd: process.cwd(),
    model: null,
  });
});

test("parseSmokeArgs accepts prompt, cwd, and model", () => {
  assert.deepEqual(
    parseSmokeArgs([
      "--prompt",
      "List files",
      "--cwd",
      "F:\\development\\f-codex",
      "--model",
      "gpt-5.4",
    ]),
    {
      help: false,
      prompt: "List files",
      cwd: "F:\\development\\f-codex",
      model: "gpt-5.4",
    },
  );
});

test("parseSmokeArgs marks help without requiring other values", () => {
  assert.deepEqual(parseSmokeArgs(["--help"]), {
    help: true,
    prompt: "Summarize this repository in one short paragraph.",
    cwd: process.cwd(),
    model: null,
  });
});

test("parseSmokeArgs rejects unknown flags", () => {
  assert.throws(() => parseSmokeArgs(["--bad"]), /Unknown argument: --bad/);
});

test("runSmokeCodexTurn waits for turn completion events", async () => {
  let emitEvent;
  const task = await runSmokeCodexTurn({
    prompt: "hello",
    cwd: "F:\\development\\f-codex",
    output: { write: () => {} },
    errorOutput: { write: () => {} },
    appServerFactory: ({ onEvent }) => {
      emitEvent = onEvent;
      return {
        start: async () => ({
          startThread: async () => ({ thread: { id: "thr_123" } }),
          startTurn: async () => {
            queueMicrotask(() => {
              emitEvent({
                method: "item/agentMessage/delta",
                params: { delta: "done" },
              });
              emitEvent({
                method: "turn/completed",
                params: { status: "success" },
              });
            });
            return { turn: { id: "turn_123" } };
          },
        }),
      };
    },
  });

  assert.equal(task.snapshot().status, "completed");
  assert.equal(task.snapshot().finalText, "done");
});
