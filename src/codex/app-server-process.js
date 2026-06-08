import { spawn } from "node:child_process";

import { AppServerSession } from "./app-server-session.js";
import { JsonLineChannel } from "./json-line-channel.js";

export class CodexAppServerProcess {
  #codexBin;
  #spawnFn;
  #onEvent;
  #onStderr;
  #onProtocolError;
  #session = null;
  #available = false;

  constructor({
    codexBin = "codex",
    spawnFn = spawn,
    onEvent = () => {},
    onStderr = () => {},
    onProtocolError = () => {},
  } = {}) {
    this.#codexBin = codexBin;
    this.#spawnFn = spawnFn;
    this.#onEvent = onEvent;
    this.#onStderr = onStderr;
    this.#onProtocolError = onProtocolError;
  }

  async start() {
    const child = this.#spawnFn(this.#codexBin, ["app-server"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

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
