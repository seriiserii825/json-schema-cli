#!/usr/bin/env node
import * as AjvNS from "ajv";
import * as addFormatsNS from "ajv-formats";
import fs from "node:fs";
import path from "node:path";
import { ensurePkg } from "./modules/ensurePkg.js";
import fetchApiFromFileUrl from "./modules/fetchApiFromFileUrl.js";
import { generateTypes } from "./modules/genTypes.js";
import getApiFilesUrls from "./modules/getApiFilesUrls.js";
import getConfig from "./modules/getConfig.js";
import { loadGenerateSchema } from "./modules/loadGenerateSchema.js";
import { err, error_color, info_color, log, success_color } from "./modules/logger.js";

// берём default если он есть, иначе сам namespace
const Ajv: any = (AjvNS as any).default ?? AjvNS;
const addFormats: any = (addFormatsNS as any).default ?? addFormatsNS;

async function run() {
  ensurePkg("generate-schema", { global: true });
  ensurePkg("json-schema-to-typescript", { global: true });
  ensurePkg("ajv", { dev: true });
  ensurePkg("ajv-formats", { dev: true });

  const config = getConfig();

  const argv = new Set(process.argv.slice(2));
  const ACCEPT = argv.has("--accept") || process.env.CONTRACT_ACCEPT === "1";

  try {
    const api_urls = getApiFilesUrls();
    const current = api_urls[0];
    const result = await fetchApiFromFileUrl(current);

    const baseName = current.file_name.replace(".php", "");
    const json_path = path.join(config.json_folder, `${baseName}-sample.json`);

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

    fs.writeFileSync(json_path, JSON.stringify(result, null, 2));
    log(success_color(`✅ JSON saved to ${path.resolve(json_path)}`));

    // --- 1) CONTRACT CHECK
    if (fs.existsSync(contract_schema_path)) {
      log(info_color("🔎 Validating fetched JSON against CONTRACT schema..."));
      const contractSchema = JSON.parse(fs.readFileSync(contract_schema_path, "utf8"));

      const ajvPrev = new Ajv({ allErrors: true, strict: false });
      addFormats(ajvPrev);
      const validatePrev = ajvPrev.compile(contractSchema);

      if (!validatePrev(result)) {
        const lines = (validatePrev.errors || [])
          .map((e) => `• path: ${e.instancePath || "/"}  msg: ${e.message}`)
          .join("\n");

        if (ACCEPT) {
          log(
            error_color(
              "⚠ Contract mismatch detected, but --accept is set. " +
                "Proceeding to generate a new schema and overwrite CONTRACT.\n" +
                lines
            )
          );
        } else {
          throw new Error(
            error_color(
              "❌ Contract BREAKING change detected (response does NOT match CONTRACT schema):\n" +
                lines +
                "\n💡 Tip: run again with --accept if you intentionally update the contract."
            )
          );
        }
      } else {
        log(success_color("✅ Contract is intact (response matches CONTRACT schema)."));
      }
    } else {
      log(info_color("ℹ No CONTRACT schema found, skipping contract validation step."));
    }

    // --- 2) Generate new schema
    const generateSchema = loadGenerateSchema();
    const schema = generateSchema.json(schema_title, result);
    schema.$schema = "http://json-schema.org/draft-07/schema#";
    schema.additionalProperties = false;

    addRequiredFields(schema);
    forceRequired(schema, ["properties", "pages", "items"], [
      "id",
      "title",
      "url",
      "img",
      "slug",
    ]);

    fs.writeFileSync(generated_schema_path, JSON.stringify(schema, null, 2));
    log(success_color(`✅ Generated schema written to ${path.resolve(generated_schema_path)}`));

    // --- 3) Validate fetched data against generated schema
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
    log(success_color("✅ Fetched JSON is valid against GENERATED schema."));

    // --- 4) Accept contract if requested
    if (ACCEPT) {
      fs.copyFileSync(generated_schema_path, contract_schema_path);
      log(
        success_color(
          `✅ CONTRACT schema updated from generated (accepted): ${path.resolve(contract_schema_path)}`
        )
      );
    } else {
      log(info_color("ℹ To accept changes to CONTRACT schema, run with --accept flag."));
    }

    // --- 5) Generate types
    log(info_color("🔎 Generating TypeScript definitions from schema..."));
    const dts = await generateTypes(schema, schema_title);
    fs.writeFileSync(type_path, dts);
    log(success_color(`✅ TypeScript definitions written to ${path.resolve(type_path)}`));
    log("🎉 Done.");
  } catch (error) {
    err(error_color(`✖ ${(error as Error).message}`));
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
