import { spawnSync } from "node:child_process";

export function generateTypes(schemaFile: string): string {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const res = spawnSync(npx, ["-y", "json-schema-to-typescript", schemaFile], { encoding: "utf8" });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error((res.stderr || res.stdout || "json-schema-to-typescript failed").toString());
  }
  return res.stdout;
}
