#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { ensurePkg } from "./modules/ensurePkg.js";
import { readClipboard } from "./modules/clipboard.js";
import { parseJsonSafe } from "./modules/json.js";
import { loadGenerateSchema } from "./modules/loadGenerateSchema.js";
import { generateTypes } from "./modules/genTypes.js";
import { ask, closePrompts } from "./modules/prompts.js";
import { log, err } from "./modules/logger.js";

async function run() {
  // 1) Ensure deps (global + dev) just like your JS version
  ensurePkg("generate-schema", { global: true });
  ensurePkg("generate-schema", { dev: true });
  ensurePkg("json-schema-to-typescript", { global: true });

  // 2) Clipboard -> JSON
  log("📋 Reading clipboard...");
  const clip = readClipboard();
  const parsed = parseJsonSafe(clip);
  if (!parsed) {
    err("✖ Clipboard content is not valid JSON. Copy valid JSON and try again.");
    process.exit(1);
  }

  // 3) Prompts
  const sampleFile = await ask("📄 Save clipboard JSON to file", "sample.json");
  const title      = await ask("🏷  Schema title", "ProductsFilterResponse");
  const schemaFile = await ask("🧩 Schema output file", "schema.json");
  const typesFile  = await ask("🔠 TypeScript .d.ts output file", "products-filter-response.d.ts");
  closePrompts();

  // 4) Save sample
  fs.writeFileSync(sampleFile, JSON.stringify(parsed, null, 2));
  log(`✅ Clipboard JSON saved to ${path.resolve(sampleFile)}`);

  // 5) Infer schema (Draft-07)
  const generateSchema = loadGenerateSchema();
  const schema = generateSchema.json(title, parsed);
  schema.$schema = "http://json-schema.org/draft-07/schema#";
  schema.additionalProperties = false;

  fs.writeFileSync(schemaFile, JSON.stringify(schema, null, 2));
  log(`✅ Schema written to ${path.resolve(schemaFile)}`);

  // 6) Generate .d.ts
  log("🛠  Generating TypeScript types...");
  const dts = generateTypes(schemaFile);
  fs.writeFileSync(typesFile, dts);
  log(`✅ Type definitions written to ${path.resolve(typesFile)}`);
  log("🎉 Done.");
}

run().catch((e: any) => {
  err(e?.stack || e?.message || String(e));
  process.exit(1);
});
