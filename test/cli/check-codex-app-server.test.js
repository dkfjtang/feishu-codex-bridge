import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseCheckCodexArgs,
  runCheckCodexAppServer,
} from "../../src/cli/check-codex-app-server.js";

test("parseCheckCodexArgs supports codex binary override", () => {
  assert.deepEqual(parseCheckCodexArgs(["--codex-bin", "codex-nightly"]), {
    help: false,
    codexBin: "codex-nightly",
  });
});

test("parseCheckCodexArgs marks help", () => {
  assert.deepEqual(parseCheckCodexArgs(["--help"]), {
    help: true,
    codexBin: "codex",
  });
});

test("parseCheckCodexArgs rejects unknown flags", () => {
  assert.throws(() => parseCheckCodexArgs(["--bad"]), /Unknown argument: --bad/);
});

test("runCheckCodexAppServer starts and initializes local app-server", async () => {
  let stdout = "";
  const calls = [];
  let stopped = false;

  const exitCode = await runCheckCodexAppServer({
    codexBin: "codex-test",
    output: { write: (text) => (stdout += text) },
    errorOutput: { write: () => {} },
    appServerFactory: (options) => {
      calls.push(options);
      return {
        start: async () => ({ initialized: true }),
        isAvailable: () => true,
        stop: () => {
          stopped = true;
        },
      };
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(calls, [{ codexBin: "codex-test" }]);
  assert.match(stdout, /Codex app-server check passed/);
  assert.equal(stopped, true);
});

test("runCheckCodexAppServer returns non-zero when app-server start fails", async () => {
  let stderr = "";
  let stopped = false;

  const exitCode = await runCheckCodexAppServer({
    output: { write: () => {} },
    errorOutput: { write: (text) => (stderr += text) },
    appServerFactory: () => ({
      start: async () => {
        throw new Error("spawn failed");
      },
      stop: () => {
        stopped = true;
      },
    }),
  });

  assert.equal(exitCode, 1);
  assert.match(stderr, /Codex app-server check failed/);
  assert.match(stderr, /spawn failed/);
  assert.equal(stopped, true);
});
