import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const STORE_VERSION = 1;

export class MemoryMessageDedupStore {
  #records = new Map();
  #now;
  #ttlMs;

  constructor({ records = [], now = () => Date.now(), ttlMs = 24 * 60 * 60 * 1000 } = {}) {
    this.#now = now;
    this.#ttlMs = ttlMs;
    for (const record of records) {
      if (record?.messageId) {
        this.#records.set(record.messageId, { ...record });
      }
    }
    this.#prune();
  }

  async has(messageId) {
    this.#prune();
    return this.#records.has(messageId);
  }

  async mark(messageId) {
    this.#prune();
    this.#records.set(messageId, {
      messageId,
      seenAt: this.#now(),
    });
    await this.afterSave();
  }

  records() {
    this.#prune();
    return [...this.#records.values()].map((record) => ({ ...record }));
  }

  replaceRecords(records) {
    this.#records.clear();
    for (const record of records) {
      if (record?.messageId) {
        this.#records.set(record.messageId, { ...record });
      }
    }
    this.#prune();
  }

  async afterSave() {}

  #prune() {
    const expiresBefore = this.#now() - this.#ttlMs;
    for (const [messageId, record] of this.#records) {
      if (Number(record.seenAt) < expiresBefore) {
        this.#records.delete(messageId);
      }
    }
  }
}

export class FileMessageDedupStore extends MemoryMessageDedupStore {
  #filePath;

  constructor({ filePath, now = () => Date.now(), ttlMs = 24 * 60 * 60 * 1000 }) {
    super({ records: [], now, ttlMs });
    this.#filePath = filePath;
  }

  async has(messageId) {
    await this.#load();
    return super.has(messageId);
  }

  async mark(messageId) {
    await this.#load();
    return super.mark(messageId);
  }

  async afterSave() {
    await mkdir(dirname(this.#filePath), { recursive: true });
    await writeFile(
      this.#filePath,
      JSON.stringify({ version: STORE_VERSION, records: this.records() }, null, 2),
      "utf8",
    );
  }

  async #load() {
    const data = await readStoreFile(this.#filePath);
    this.replaceRecords(data.records ?? []);
  }
}

async function readStoreFile(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return { version: STORE_VERSION, records: [] };
    }
    throw error;
  }
}
