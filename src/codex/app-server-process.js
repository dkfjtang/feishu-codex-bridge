import { spawn } from "node:child_process";

import { AppServerSession } from "./app-server-session.js";
import { JsonLineChannel } from "./json-line-channel.js";

export class CodexAppServerProcess {
  #codexBin;
  #processPlatform;
  #spawnFn;
  #onEvent;
  #onStderr;
  #onProtocolError;
  #child = null;
  #session = null;
  #available = false;

  constructor({
    codexBin = "codex",
    processPlatform = process.platform,
    spawnFn = spawn,
    onEvent = () => {},
    onStderr = () => {},
    onProtocolError = () => {},
  } = {}) {
    this.#codexBin = codexBin;
    this.#processPlatform = processPlatform;
    this.#spawnFn = spawnFn;
    this.#onEvent = onEvent;
    this.#onStderr = onStderr;
    this.#onProtocolError = onProtocolError;
  }

  async start() {
    const spawnSpec = buildAppServerSpawnSpec(this.#codexBin, this.#processPlatform);
    const child = this.#spawnFn(spawnSpec.command, spawnSpec.args, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.#child = child;

    this.#session = new AppServerSession({
      write: (message) => channel.write(message),
      onEvent: this.#onEvent,
    });

    const channel = new JsonLineChannel({
      input: child.stdout,
      output: child.stdin,
      onMessage: (message) => this.#session.handleMessage(message),
      onError: this.#onProtocolError,
    });

    forwardLines(child.stderr, this.#onStderr);

    child.on("exit", () => {
      this.#available = false;
    });

    await this.#session.initialize();
    this.#available = true;
    return this.#session;
  }

  session() {
    return this.#session;
  }

  isAvailable() {
    return this.#available;
  }

  stop() {
    this.#available = false;
    if (this.#child && typeof this.#child.kill === "function") {
      this.#child.kill();
    }
    this.#child = null;
  }
}

function buildAppServerSpawnSpec(codexBin, processPlatform) {
  if (processPlatform === "win32" && codexBin === "codex") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "codex.cmd app-server"],
    };
  }

  return {
    command: codexBin,
    args: ["app-server"],
  };
}

function forwardLines(stream, onLine) {
  let buffer = "";

  stream.on("data", (chunk) => {
    buffer += chunk.toString("utf8");

    while (buffer.includes("\n")) {
      const newlineIndex = buffer.indexOf("\n");
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) {
        onLine(line);
      }
    }
  });
}
