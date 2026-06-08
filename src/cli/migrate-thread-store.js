import { readFile } from "node:fs/promises";

import { SqliteThreadStore } from "../store/thread-store.js";

const DEFAULT_JSON_PATH = "data/threads.json";
const DEFAULT_SQLITE_PATH = "data/threads.sqlite";

export function parseMigrateThreadStoreArgs(args) {
  const parsed = {
    help: false,
    fromJson: DEFAULT_JSON_PATH,
    toSqlite: DEFAULT_SQLITE_PATH,
    dryRun: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--from-json") {
      parsed.fromJson = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--to-sqlite") {
      parsed.toSqlite = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

export function migrateThreadStoreHelp() {
  return [
    "Usage: npm run migrate:thread-store -- [--from-json <path>] [--to-sqlite <path>] [--dry-run]",
    "",
    "Migrates JSON thread mappings to the SQLite thread store.",
    "Default source: data/threads.json",
    "Default target: data/threads.sqlite",
  ].join("\n");
}

export async function runMigrateThreadStore({
  fromJson = DEFAULT_JSON_PATH,
  toSqlite = DEFAULT_SQLITE_PATH,
  dryRun = false,
  output = process.stdout,
  errorOutput = process.stderr,
  sqliteStoreFactory = (options) => new SqliteThreadStore(options),
} = {}) {
  let records;
  try {
    records = await readJsonThreadRecords(fromJson);
  } catch (error) {
    errorOutput.write(`Thread store migration failed:\n- ${error.message}\n`);
    return 1;
  }

  const validRecords = records.filter(isMigratableRecord);
  const skippedCount = records.length - validRecords.length;

  if (dryRun) {
    output.write("Thread store migration dry run.\n");
    output.write(`source: ${fromJson}\n`);
    output.write(`target: ${toSqlite}\n`);
    output.write(`records: ${records.length}\n`);
    output.write(`migratable: ${validRecords.length}\n`);
    output.write(`skipped: ${skippedCount}\n`);
    return 0;
  }

  const store = sqliteStoreFactory({ filePath: toSqlite });
  try {
    for (const record of validRecords) {
      await store.saveThread(record);
    }
  } finally {
    store.close?.();
  }

  output.write("Thread store migration completed.\n");
  output.write(`source: ${fromJson}\n`);
  output.write(`target: ${toSqlite}\n`);
  output.write(`migrated: ${validRecords.length}\n`);
  output.write(`skipped: ${skippedCount}\n`);
  return 0;
}

async function readJsonThreadRecords(filePath) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Source JSON thread store not found: ${filePath}`);
    }
    throw error;
  }

  if (!Array.isArray(parsed.records)) {
    throw new Error("Source JSON thread store must contain a records array");
  }

  return parsed.records;
}

function isMigratableRecord(record) {
  return Boolean(record?.openId && record.cwd && record.threadId);
}

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }

  return value;
}
