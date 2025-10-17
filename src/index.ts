#!/usr/bin/env node
// import Ajv from "ajv";
// import addFormats from "ajv-formats";

// вместо: import Ajv from "ajv"; import addFormats from "ajv-formats";
import * as AjvNS from "ajv";
import * as addFormatsNS from "ajv-formats";

// берём default если он есть, иначе сам namespace
const Ajv: any = (AjvNS as any).default ?? AjvNS;
const addFormats: any = (addFormatsNS as any).default ?? addFormatsNS;

import fs from "node:fs";
import path from "node:path";
import { ensurePkg } from "./modules/ensurePkg.js";
import { readClipboard } from "./modules/clipboard.js";
import { parseJsonSafe } from "./modules/json.js";
import { loadGenerateSchema } from "./modules/loadGenerateSchema.js";
import { generateTypes } from "./modules/genTypes.js";
import { ask, closePrompts } from "./modules/prompts.js";
import { log, err } from "./modules/logger.js";
import getApiFilesUrls from "./modules/getApiFilesUrls.js";
import fetchApiFromFileUrl from "./modules/fetchApiFromFileUrl.js";
import getConfig from "./modules/getConfig.js";

async function run() {
  // 1) Ensure deps (global + dev) just like your JS version
  ensurePkg("generate-schema", { global: true });
  // ensurePkg("generate-schema", { dev: true });
  ensurePkg("json-schema-to-typescript", { global: true });
  ensurePkg("ajv", { dev: true });
  ensurePkg("ajv-formats", { dev: true });

  const config = getConfig();

  try {
    const api_urls = getApiFilesUrls();
    const result = await fetchApiFromFileUrl(api_urls[0]);

    // 4) Validate AGAINST PREVIOUS schema (contract check) BEFORE regenerating
    const prevSchemaPath = path.join(
      config.schema_folder,
      `${api_urls[0].file_name.replace(".php", "")}-schema.json`,
    );

    if (fs.existsSync(prevSchemaPath)) {
      log("🔒 Contract check: validating response against PREVIOUS schema...");
      const prevSchema = JSON.parse(fs.readFileSync(prevSchemaPath, "utf-8"));

      const ajvPrev = new Ajv({ allErrors: true, strict: false });
      addFormats(ajvPrev);
      const validatePrev = ajvPrev.compile(prevSchema);

      if (!validatePrev(result)) {
        const lines = (validatePrev.errors || [])
          .map((e) => `• path: ${e.instancePath || "/"}  msg: ${e.message}`)
          .join("\n");
        throw new Error(
          "❌ Contract BREAKING change detected (response does NOT match previous schema):\n" +
            lines +
            "\nTip: backend removed/changed a field (e.g., `slug`).",
        );
      }
      log("✅ Contract is intact (response matches previous schema).");
    } else {
      log("ℹ No previous schema found — skipping contract check (first run?).");
    }

    const jsonText = JSON.stringify(result, null, 2); // <- pretty JSON string
    console.log(jsonText);
    const json_path = path.join(
      config.json_folder,
      api_urls[0].file_name.replace(".php", "") + "-sample.json",
    );
    const schema_path = path.join(
      config.schema_folder,
      `${api_urls[0].file_name.replace(".php", "")}-schema.json`,
    );
    const schema_title = api_urls[0].file_name
      .replace(".php", "")
      .replace(/(^\w|-\w)/g, (match) => match.replace("-", "").toUpperCase());
    const type_path = path.join(
      config.types_folder,
      `${api_urls[0].file_name.replace(".php", "")}-types.d.ts`,
    );

    fs.writeFileSync(json_path, jsonText);
    log(`✅ JSON saved to ${path.resolve(json_path)}`);

    // 5) Infer schema (Draft-07)
    const generateSchema = loadGenerateSchema();
    const schema = generateSchema.json(schema_title, result);
    schema.$schema = "http://json-schema.org/draft-07/schema#";
    schema.additionalProperties = false;
    // ✅ добавить required во все объекты
    addRequiredFields(schema);

    fs.writeFileSync(schema_path, JSON.stringify(schema, null, 2));
    log(`✅ Schema written to ${path.resolve(schema_path)}`);

    // 6) Validate schema with Ajv
    log("🔎 Validating fetched JSON against generated schema...");
    const ajv = new Ajv({
      allErrors: true,
      strict: false,
      removeAdditional: "all",
      useDefaults: true,
    });
    addFormats(ajv);

    const validate = ajv.compile(schema);
    if (!validate(result)) {
      // Красивый вывод всех ошибок
      const lines = (validate.errors || [])
        .map(
          (e) =>
            `• path: ${e.instancePath || "/"}  msg: ${e.message}  ${e.keyword === "type" ? `(expected ${JSON.stringify(e.params)})` : ""}`,
        )
        .join("\n");
      throw new Error(`Schema validation failed:\n${lines}`);
    }
    log("✅ Data conforms to generated schema");

    // 7) Generate .d.ts
    log("🛠  Generating TypeScript types...");
    const dts = await generateTypes(schema, schema_title);
    fs.writeFileSync(type_path, dts);
    log(`✅ Type definitions written to ${path.resolve(type_path)}`);
    log("🎉 Done.");
  } catch (error) {
    err(`✖ ${(error as Error).message}`);
    process.exit(1);
  }
}

run().catch((e: any) => {
  err(e?.stack || e?.message || String(e));
  process.exit(1);
});

function addRequiredFields(schemaObj) {
  if (schemaObj && typeof schemaObj === "object") {
    if (schemaObj.type === "object" && schemaObj.properties) {
      const props = Object.keys(schemaObj.properties);
      if (props.length > 0) {
        schemaObj.required = props;
      }
      // рекурсивно обходим все поля
      for (const key of props) {
        addRequiredFields(schemaObj.properties[key]);
      }
    } else if (schemaObj.type === "array" && schemaObj.items) {
      addRequiredFields(schemaObj.items);
    }
  }
}
