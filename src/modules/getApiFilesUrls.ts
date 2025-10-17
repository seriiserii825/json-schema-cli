import path from "node:path";
import { fileURLToPath } from "node:url";
export default function getApiFilesUrls(): string[] {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  console.log("__filename:", __filename);
  console.log("__dirname:", __dirname);

  const cwd = process.cwd();
  console.log("called from:", cwd);

  // example: join relative path from project root
  const apiDir = path.join(cwd, "src/api");
  console.log("apiDir:", apiDir);
  return ["some"];
}
