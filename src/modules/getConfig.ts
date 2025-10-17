import fs from 'fs';
import path from "path";
import {TConfig} from "../custom_types/TConfig.js";

export default function getConfig(): TConfig {
  const cwd = process.cwd();
  const theme_path = path.resolve(cwd);
  const theme_name = cwd.split("/").pop() || "unknown_theme";
  const api_folder = path.join(cwd, "api");
  console.log("api_folder", api_folder);
  const json_folder = path.join(cwd, "json");
  console.log("json_folder", json_folder);
  if (fs.existsSync(json_folder) === false) {
    fs.mkdirSync(json_folder, { recursive: true });
  }
  const schema_folder = path.join(cwd, "schemas");
  console.log("schema_folder", schema_folder);
  if (fs.existsSync(schema_folder) === false) {
    fs.mkdirSync(schema_folder, { recursive: true });
  }
  const types_folder = path.join(cwd, "src", "vue", "types");
  console.log("types_folder", types_folder);
  if (fs.existsSync(types_folder) === false) {
    fs.mkdirSync(types_folder, { recursive: true });
  }
  return {
    theme_name,
    theme_path,
    api_folder,
    json_folder,
    schema_folder,
    types_folder,
  };
}
