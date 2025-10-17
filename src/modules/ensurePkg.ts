import { execSync } from "node:child_process";
import { log } from "./logger.js";

const isInstalled = (pkg: string, global = false): boolean => {
  try {
    execSync(`npm ls ${pkg} ${global ? "-g" : ""}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

export function ensurePkg(pkg: string, opts: { global?: boolean; dev?: boolean } = {}) {
  const { global = false, dev = false } = opts;
  if (isInstalled(pkg, global)) return;
  const flag = global ? "-g" : dev ? "-D" : "";
  const where = global ? "global" : dev ? "dev" : "local";
  log(`📦 Installing ${where} dependency: ${pkg} ...`);
  execSync(`npm install ${flag} ${pkg}`, { stdio: "inherit" });
}
