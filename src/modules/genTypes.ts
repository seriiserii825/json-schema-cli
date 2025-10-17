// generateTypes.ts
import fs from "node:fs";
import path from "node:path";
import { compile, type JSONSchema } from "json-schema-to-typescript";

/**
 * Generate TypeScript definitions from a JSON Schema.
 * - Accepts either a schema object or a path to a schema JSON file.
 *
 * @param schemaOrPath - JSON schema object OR path to .json schema file
 * @param rootName     - Top-level type name (fallback: filename or "Root")
 */
export async function generateTypes(
  schemaOrPath: JSONSchema | string,
  rootName?: string,
): Promise<string> {
  let schema: JSONSchema;
  let inferredName = "Root";

  if (typeof schemaOrPath === "string") {
    const abs = path.resolve(schemaOrPath);
    const raw = fs.readFileSync(abs, "utf8");
    schema = JSON.parse(raw);
    inferredName = path.basename(abs).replace(/\.(schema\.)?json$/i, "") || inferredName;
  } else {
    schema = schemaOrPath;
  }

  const name = rootName || schema.title || inferredName;

  // Ensure strictness is preserved if you've set it upstream
  // (compile respects schema.additionalProperties)
  const dts = await compile(schema, name, {
    bannerComment: "", // no header
  });

  return dts;
}
