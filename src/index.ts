#!/usr/bin/env node
import * as AjvNS from "ajv";
import * as addFormatsNS from "ajv-formats";

// берём default если он есть, иначе сам namespace
const Ajv: any = (AjvNS as any).default ?? AjvNS;
const addFormats: any = (addFormatsNS as any).default ?? addFormatsNS;

import fs from "node:fs";
import path from "node:path";
import { ensurePkg } from "./modules/ensurePkg.js";
import { loadGenerateSchema } from "./modules/loadGenerateSchema.js";
import { generateTypes } from "./modules/genTypes.js";
import { log, err } from "./modules/logger.js";
import getApiFilesUrls from "./modules/getApiFilesUrls.js";
import fetchApiFromFileUrl from "./modules/fetchApiFromFileUrl.js";
import getConfig from "./modules/getConfig.js";

// ... верх файла без изменений (Ajv импорты/шимы и т.п.)

async function run() {
  // deps ...
  ensurePkg("generate-schema", { global: true });
  ensurePkg("json-schema-to-typescript", { global: true });
  ensurePkg("ajv", { dev: true });
  ensurePkg("ajv-formats", { dev: true });

  const config = getConfig();
  const ACCEPT = process.argv.includes("--accept") || process.env.CONTRACT_ACCEPT === "1";

  try {
    const api_urls = getApiFilesUrls();
    const current = api_urls[0];
    const result = await fetchApiFromFileUrl(current);

    // --- paths
    const baseName = current.file_name.replace(".php", "");
    const json_path = path.join(config.json_folder, `${baseName}-sample.json`);

    // NEW: разносим контракт и генерат
    const contract_schema_path = path.join(
      config.schema_folder,
      `${baseName}-contract.schema.json`
    );
    const generated_schema_path = path.join(
      config.schema_folder,
      `${baseName}-generated.schema.json`
    );

    const schema_title = baseName.replace(/(^\w|-\w)/g, (m) => m.replace("-", "").toUpperCase());
    const type_path = path.join(config.types_folder, `${baseName}-types.d.ts`);

    // --- save sample JSON (для удобства)
    fs.writeFileSync(json_path, JSON.stringify(result, null, 2));
    log(`✅ JSON saved to ${path.resolve(json_path)}`);

    // --- 1) CONTRACT CHECK: валидируем против контракта до любой регенерации
    if (fs.existsSync(contract_schema_path)) {
      log("🔒 Contract check: validating response against CONTRACT schema...");
      const contractSchema = JSON.parse(fs.readFileSync(contract_schema_path, "utf8"));

      const ajvPrev = new Ajv({ allErrors: true, strict: false });
      addFormats(ajvPrev);
      const validatePrev = ajvPrev.compile(contractSchema);

      if (!validatePrev(result)) {
        const lines = (validatePrev.errors || [])
          .map((e) => `• path: ${e.instancePath || "/"}  msg: ${e.message}`)
          .join("\n");
        throw new Error(
          "❌ Contract BREAKING change detected (response does NOT match CONTRACT schema):\n" +
            lines +
            "\n💡 Tip: backend removed/changed a field (e.g., `slug`). " +
            "Inspect diff and run with --accept only if you intentionally update the contract."
        );
      }
      log("✅ Contract is intact (response matches CONTRACT schema).");
    } else {
      log("ℹ No CONTRACT schema found — skipping contract check (first run?).");
    }

    // --- 2) Генерим новую схему ИЗ текущего ответа (это просто «снимок факта»)
    const generateSchema = loadGenerateSchema();
    const schema = generateSchema.json(schema_title, result);
    schema.$schema = "http://json-schema.org/draft-07/schema#";
    schema.additionalProperties = false;

    // Делает все поля в объекте required (механически)
    addRequiredFields(schema);

    // (ОПЦИОНАЛЬНО) Прибить конкретные обязательные поля для items pages:
    forceRequired(schema, ["properties", "pages", "items"], ["id", "title", "url", "img", "slug"]);

    // Сохраняем только в *generated*
    fs.writeFileSync(generated_schema_path, JSON.stringify(schema, null, 2));
    log(`✅ Generated schema written to ${path.resolve(generated_schema_path)}`);

    // --- 3) Валидация текущих данных против *generated* (просто sanity check)
    log("🔎 Validating fetched JSON against GENERATED schema...");
    const ajv = new Ajv({
      allErrors: true,
      strict: false,
      removeAdditional: "all",
      useDefaults: true,
    });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    if (!validate(result)) {
      const lines = (validate.errors || [])
        .map((e) => `• path: ${e.instancePath || "/"}  msg: ${e.message}`)
        .join("\n");
      throw new Error(`Schema validation failed (generated):\n${lines}`);
    }
    log("✅ Data conforms to GENERATED schema");

    // --- 4) По желанию «принять» изменения контракта (ручной шаг)
    if (ACCEPT) {
      fs.copyFileSync(generated_schema_path, contract_schema_path);
      log(
        `✅ CONTRACT schema updated from generated (accepted): ${path.resolve(contract_schema_path)}`
      );
    } else {
      log("ℹ CONTRACT schema left unchanged. Use --accept to update it intentionally.");
    }

    // --- 5) Типы
    log("🛠  Generating TypeScript types from GENERATED schema...");
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

function addRequiredFields(schemaObj: any) {
  if (schemaObj && typeof schemaObj === "object") {
    if (schemaObj.type === "object" && schemaObj.properties) {
      const props = Object.keys(schemaObj.properties);
      if (props.length > 0) schemaObj.required = props;
      for (const key of props) addRequiredFields(schemaObj.properties[key]);
    } else if (schemaObj.type === "array" && schemaObj.items) {
      addRequiredFields(schemaObj.items);
    }
  }
}

/**
 * Принудительно делает перечисленные свойства обязательными у узла по пути
 * pathSpec: массив ключей до узла-объекта (например ["properties","pages","items"])
 */
function forceRequired(schemaObj: any, pathSpec: string[], requiredList: string[]) {
  let node = schemaObj;
  for (const key of pathSpec) {
    node = node?.[key];
    if (!node) return;
  }
  if (node.type === "object" && node.properties) {
    const set = new Set(node.required ?? []);
    for (const r of requiredList) set.add(r);
    node.required = [...set];
  }
}
