#!/usr/bin/env node
import {
  checkCodexHelp,
  parseCheckCodexArgs,
  runCheckCodexAppServer,
} from "../src/cli/check-codex-app-server.js";

let options;
try {
  options = parseCheckCodexArgs(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error.message}\n\n${checkCodexHelp()}\n`);
  process.exit(1);
}

if (options.help) {
  process.stdout.write(`${checkCodexHelp()}\n`);
  process.exit(0);
}

const exitCode = await runCheckCodexAppServer({
  codexBin: options.codexBin,
});
process.exit(exitCode);
