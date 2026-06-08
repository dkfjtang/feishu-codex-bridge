import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { test } from "node:test";

import { CodexAppServerProcess } from "../../src/codex/app-server-process.js";

test("start spawns codex app-server and initializes the session", async () => {
  const child = createFakeChildProcess();
  const spawnCalls = [];
  const process = new CodexAppServerProcess({
    codexBin: "codex",
    processPlatform: "linux",
    spawnFn: (command, args, options) => {
      spawnCalls.push({ command, args, options });
      return child;
    },
  });

  const startPromise = process.start();
  const written = child.stdin.read().toString("utf8");

  assert.deepEqual(spawnCalls, [
    {
      command: "codex",
      args: ["app-server"],
      options: { stdio: ["pipe", "pipe", "pipe"] },
    },
  ]);
  assert.match(written, /"method":"initialize"/);

  child.stdout.write('{"id":1,"result":{"userAgent":"codex-test"}}\n');

  const session = await startPromise;
  assert.equal(session, process.session());

  const initialized = child.stdin.read().toString("utf8");
  assert.match(initialized, /"method":"initialized"/);
});

test("start resolves bare codex to cmd shim on Windows", async () => {
  const child = createFakeChildProcess();
  const spawnCalls = [];
  const process = new CodexAppServerProcess({
    codexBin: "codex",
    processPlatform: "win32",
    spawnFn: (command, args, options) => {
      spawnCalls.push({ command, args, options });
      return child;
    },
  });

  const startPromise = process.start();
  child.stdout.write('{"id":1,"result":{}}\n');
  await startPromise;

  assert.deepEqual(spawnCalls, [
    {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "codex.cmd app-server"],
      options: { stdio: ["pipe", "pipe", "pipe"] },
    },
  ]);
});

test("start keeps explicit codex binary values unchanged", async () => {
  const child = createFakeChildProcess();
  const spawnCalls = [];
  const process = new CodexAppServerProcess({
    codexBin: "codex-nightly",
    processPlatform: "win32",
    spawnFn: (command, args, options) => {
      spawnCalls.push({ command, args, options });
      return child;
    },
  });

  const startPromise = process.start();
  child.stdout.write('{"id":1,"result":{}}\n');
  await startPromise;

  assert.equal(spawnCalls[0].command, "codex-nightly");
});

test("stderr lines are forwarded to the log handler", () => {
  const child = createFakeChildProcess();
  const logs = [];
  const process = new CodexAppServerProcess({
    spawnFn: () => child,
    onStderr: (line) => logs.push(line),
  });

  void process.start();
  child.stderr.write("warning one\nwarning two\n");

  assert.deepEqual(logs, ["warning one", "warning two"]);
});

test("exit event marks process unavailable", async () => {
  const child = createFakeChildProcess();
  const events = [];
  const process = new CodexAppServerProcess({
    spawnFn: () => child,
    onEvent: (event) => events.push(event),
  });

  const startPromise = process.start();
  child.stdout.write('{"id":1,"result":{}}\n');
  await startPromise;

  assert.equal(process.isAvailable(), true);

  child.emit("exit", 1, null);

  assert.equal(process.isAvailable(), false);
  assert.deepEqual(events, [
    {
      method: "appServer/disconnected",
      params: {
        code: 1,
        signal: null,
      },
    },
  ]);
});

test("stop terminates the child process and marks it unavailable", async () => {
  const child = createFakeChildProcess();
  let killed = false;
  child.kill = () => {
    killed = true;
  };
  const process = new CodexAppServerProcess({
    spawnFn: () => child,
  });

  const startPromise = process.start();
  child.stdout.write('{"id":1,"result":{}}\n');
  await startPromise;

  process.stop();

  assert.equal(killed, true);
  assert.equal(process.isAvailable(), false);
});

function createFakeChildProcess() {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  return child;
}
