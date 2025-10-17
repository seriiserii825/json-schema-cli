import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

type GenerateSchemaModule = {
  default?: { json: (title: string, sample: unknown) => any };
  json?: (title: string, sample: unknown) => any;
};

export function loadGenerateSchema(): { json: (title: string, sample: unknown) => any } {
  // Prefer local (CWD) install
  try {
    const requireLocal = createRequire(path.join(process.cwd(), "package.json"));
    const mod = requireLocal("generate-schema") as GenerateSchemaModule;
    const api = (mod.default ?? mod) as any;
    if (typeof api?.json === "function") return api;
  } catch {
    /* fall back to global */
  }

  // Fallback to global
  const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
  const requireGlobal = createRequire(path.join(globalRoot, "x.js"));
  const mod = requireGlobal("generate-schema") as GenerateSchemaModule;
  const api = (mod.default ?? mod) as any;
  if (typeof api?.json === "function") return api;

  throw new Error("Unable to load generate-schema");
}
