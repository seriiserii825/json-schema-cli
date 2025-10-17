#!/usr/bin/env node
import { spawn } from "node:child_process";
const child = spawn(process.execPath, ["--loader", "tsx", "src/main.ts"], {
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 0));
