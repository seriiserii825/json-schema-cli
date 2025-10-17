import path from "path";
import {TConfig} from "../custom_types/TConfig.js";

export default function getConfig(): TConfig {
  const cwd = process.cwd();
  const theme_path = path.resolve(cwd);
  const theme_name = cwd.split("/").pop() || "unknown_theme";
  const api_folder = path.join(cwd, "api");
  return {
    theme_name,
    theme_path,
    api_folder,
  };
}
