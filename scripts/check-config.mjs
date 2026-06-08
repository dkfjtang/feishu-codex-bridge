#!/usr/bin/env node
import { runCheckConfig } from "../src/cli/check-config.js";

const exitCode = await runCheckConfig();
process.exit(exitCode);
