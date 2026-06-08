#!/usr/bin/env node
import {
  migrateThreadStoreHelp,
  parseMigrateThreadStoreArgs,
  runMigrateThreadStore,
} from "../src/cli/migrate-thread-store.js";

let options;
try {
  options = parseMigrateThreadStoreArgs(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error.message}\n\n${migrateThreadStoreHelp()}\n`);
  process.exit(1);
}

if (options.help) {
  process.stdout.write(`${migrateThreadStoreHelp()}\n`);
  process.exit(0);
}

const exitCode = await runMigrateThreadStore({
  fromJson: options.fromJson,
  toSqlite: options.toSqlite,
  dryRun: options.dryRun,
});
process.exit(exitCode);
