#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createRequire } from "node:module";

const rl = createInterface({ input, output });
const log = (...a) => console.log(...a);
const err = (...a) => console.error(...a);

function pkgInstalled(pkg, global = false) {
  try {
    execSync(`npm ls ${pkg} ${global ? "-g" : ""}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function ensurePkg(pkg, opts = { global: false, dev: false }) {
  const flag = opts.global ? "-g" : opts.dev ? "-D" : "";
  const where = opts.global ? "global" : opts.dev ? "dev" : "local";
  if (!pkgInstalled(pkg, opts.global)) {
    log(`📦 Installing ${where} dependency: ${pkg} ...`);
    execSync(`npm install ${flag} ${pkg}`, { stdio: "inherit" });
  }
}

function readClipboard() {
  const cmds = ["xclip -selection clipboard -o", "wl-paste", "pbpaste", "xsel -ob"];
  for (const cmd of cmds) {
    try {
      const out = execSync(cmd, { encoding: "utf8", stdio: ["ignore","pipe","ignore"] });
      if (out && out.trim()) return out;
    } catch {}
  }
  throw new Error("No clipboard tool found (xclip / wl-paste / pbpaste / xsel).");
}

const parseJsonSafe = (t) => { try { return JSON.parse(t); } catch { return null; } };

function loadGenerateSchema() {
  const requireLocal = createRequire(path.join(process.cwd(), "package.json"));
  try { return requireLocal("generate-schema"); } 
  catch {
    const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
    const requireGlobal = createRequire(path.join(globalRoot, "x.js"));
    return requireGlobal("generate-schema");
  }
}

async function main() {
  ensurePkg("generate-schema", { global: true });
  ensurePkg("generate-schema", { dev: true });
  ensurePkg("json-schema-to-typescript", { global: true });

  const generateSchema = loadGenerateSchema().default || loadGenerateSchema();

  log("📋 Reading clipboard...");
  const clip = readClipboard();

  const parsed = parseJsonSafe(clip);
  if (!parsed) {
    err("✖ Clipboard content is not valid JSON. Copy valid JSON and try again.");
    process.exit(1);
  }

  const rlq = (q, d) => rl.question(`${q} [${d}]: `).then(v => (v.trim() || d));
  const sampleFile = await rlq("📄 Save clipboard JSON to file", "sample.json");
  const title      = await rlq("🏷  Schema title", "ProductsFilterResponse");
  const schemaFile = await rlq("🧩 Schema output file", "schema.json");
  const typesFile  = await rlq("🔠 TypeScript .d.ts output file", "products-filter-response.d.ts");
  rl.close();

  fs.writeFileSync(sampleFile, JSON.stringify(parsed, null, 2));
  log(`✅ Clipboard JSON saved to ${path.resolve(sampleFile)}`);

  let schema = generateSchema.json(title, parsed);
  schema.$schema = "http://json-schema.org/draft-07/schema#";
  schema.additionalProperties = false;

  fs.writeFileSync(schemaFile, JSON.stringify(schema, null, 2));
  log(`✅ Schema written to ${path.resolve(schemaFile)}`);

  log("🛠  Generating TypeScript types...");
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const res = spawnSync(npx, ["-y", "json-schema-to-typescript", schemaFile], { encoding: "utf8" });
  if (res.status !== 0) {
    err(`✖ json-schema-to-typescript failed:\n${res.stderr || res.stdout}`);
    process.exit(1);
  }

  fs.writeFileSync(typesFile, res.stdout);
  log(`✅ Type definitions written to ${path.resolve(typesFile)}`);
  log("🎉 Done.");
}

main().catch((e) => { err(e.stack || e.message); process.exit(1); });
