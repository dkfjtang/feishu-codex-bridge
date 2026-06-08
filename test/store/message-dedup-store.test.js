import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  FileMessageDedupStore,
  MemoryMessageDedupStore,
} from "../../src/store/message-dedup-store.js";

test("MemoryMessageDedupStore stores message ids within ttl", async () => {
  const store = new MemoryMessageDedupStore({
    now: () => 1_000,
    ttlMs: 60_000,
  });

  assert.equal(await store.has("om_123"), false);
  await store.mark("om_123");
  assert.equal(await store.has("om_123"), true);
});

test("MemoryMessageDedupStore expires old message ids", async () => {
  let now = 1_000;
  const store = new MemoryMessageDedupStore({
    now: () => now,
    ttlMs: 60_000,
  });

  await store.mark("om_123");
  now = 62_000;

  assert.equal(await store.has("om_123"), false);
});

test("FileMessageDedupStore persists message ids across instances", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "fca-dedup-"));
  const filePath = path.join(dir, "dedup.json");
  try {
    const first = new FileMessageDedupStore({
      filePath,
      now: () => 1_000,
      ttlMs: 60_000,
    });
    await first.mark("om_123");

    const second = new FileMessageDedupStore({
      filePath,
      now: () => 2_000,
      ttlMs: 60_000,
    });

    assert.equal(await second.has("om_123"), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
