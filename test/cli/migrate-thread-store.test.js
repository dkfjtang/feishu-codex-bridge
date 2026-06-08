import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  parseMigrateThreadStoreArgs,
  runMigrateThreadStore,
} from "../../src/cli/migrate-thread-store.js";
import { SqliteThreadStore } from "../../src/store/thread-store.js";

test("parseMigrateThreadStoreArgs uses safe defaults", () => {
  assert.deepEqual(parseMigrateThreadStoreArgs([]), {
    help: false,
    fromJson: "data/threads.json",
    toSqlite: "data/threads.sqlite",
    dryRun: false,
  });
});

test("parseMigrateThreadStoreArgs accepts paths and dry run", () => {
  assert.deepEqual(
    parseMigrateThreadStoreArgs([
      "--from-json",
      "data/custom-threads.json",
      "--to-sqlite",
      "data/custom-threads.sqlite",
      "--dry-run",
    ]),
    {
      help: false,
      fromJson: "data/custom-threads.json",
      toSqlite: "data/custom-threads.sqlite",
      dryRun: true,
    },
  );
});

test("parseMigrateThreadStoreArgs rejects unknown flags", () => {
  assert.throws(() => parseMigrateThreadStoreArgs(["--bad"]), /Unknown argument: --bad/);
});

test("runMigrateThreadStore reports dry run counts without writing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "fca-migrate-thread-store-"));
  const jsonPath = join(dir, "threads.json");
  const sqlitePath = join(dir, "threads.sqlite");

  try {
    await writeFile(
      jsonPath,
      JSON.stringify({
        version: 1,
        records: [
          {
            openId: "ou_1",
            cwd: "F:\\development\\f-codex",
            threadId: "thr_1",
          },
          { openId: "ou_bad", cwd: "F:\\development\\f-codex" },
        ],
      }),
      "utf8",
    );

    let stdout = "";
    const exitCode = await runMigrateThreadStore({
      fromJson: jsonPath,
      toSqlite: sqlitePath,
      dryRun: true,
      output: { write: (text) => (stdout += text) },
      errorOutput: { write: () => {} },
    });

    assert.equal(exitCode, 0);
    assert.match(stdout, /Thread store migration dry run/);
    assert.match(stdout, /records: 2/);
    assert.match(stdout, /migratable: 1/);
    assert.match(stdout, /skipped: 1/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("runMigrateThreadStore writes JSON records to SQLite store", async () => {
  const dir = await mkdtemp(join(tmpdir(), "fca-migrate-thread-store-"));
  const jsonPath = join(dir, "threads.json");
  const sqlitePath = join(dir, "threads.sqlite");

  try {
    await writeFile(
      jsonPath,
      JSON.stringify({
        version: 1,
        records: [
          {
            openId: "ou_1",
            cwd: "F:\\development\\f-codex",
            threadId: "thr_private",
            lastTurnId: "turn_private",
            lastSeenAt: "old-time",
          },
          {
            openId: "ou_2",
            chatId: "oc_group",
            chatType: "group",
            conversationId: "oc_group",
            cwd: "F:\\development\\f-codex",
            threadId: "thr_group",
          },
        ],
      }),
      "utf8",
    );

    let stdout = "";
    const exitCode = await runMigrateThreadStore({
      fromJson: jsonPath,
      toSqlite: sqlitePath,
      output: { write: (text) => (stdout += text) },
      errorOutput: { write: () => {} },
    });

    assert.equal(exitCode, 0);
    assert.match(stdout, /migrated: 2/);

    const store = new SqliteThreadStore({ filePath: sqlitePath });
    try {
      assert.deepEqual(await store.getThread({ openId: "ou_1", cwd: "F:\\development\\f-codex" }), {
        openId: "ou_1",
        cwd: "F:\\development\\f-codex",
        threadId: "thr_private",
        lastTurnId: "turn_private",
        lastSeenAt: "old-time",
      });
      const groupRecord = await store.getThread({
        conversationId: "oc_group",
        cwd: "F:\\development\\f-codex",
      });
      assert.equal(typeof groupRecord.lastSeenAt, "string");
      assert.deepEqual(
        { ...groupRecord, lastSeenAt: "normalized" },
        {
          openId: "ou_2",
          chatId: "oc_group",
          chatType: "group",
          conversationId: "oc_group",
          cwd: "F:\\development\\f-codex",
          threadId: "thr_group",
          lastTurnId: null,
          lastSeenAt: "normalized",
        },
      );
    } finally {
      store.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("runMigrateThreadStore reports missing source file", async () => {
  let stderr = "";
  const exitCode = await runMigrateThreadStore({
    fromJson: "missing-thread-store.json",
    output: { write: () => {} },
    errorOutput: { write: (text) => (stderr += text) },
  });

  assert.equal(exitCode, 1);
  assert.match(stderr, /Source JSON thread store not found/);
});
