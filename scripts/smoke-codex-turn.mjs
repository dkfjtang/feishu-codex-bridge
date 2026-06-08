#!/usr/bin/env node
import {
  parseSmokeArgs,
  runSmokeCodexTurn,
  smokeHelp,
} from "../src/cli/smoke-codex-turn.js";

try {
  const options = parseSmokeArgs(process.argv.slice(2));

  if (options.help) {
    console.log(smokeHelp());
    process.exit(0);
  }

  const task = await runSmokeCodexTurn(options);
  const snapshot = task.snapshot();
  console.log(snapshot.finalText || snapshot.summaryText);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
