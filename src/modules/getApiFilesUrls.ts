import fs from "fs";
import path from "node:path";
type TConfig = {
  theme_name: string;
  api_folder: string;
};
export default function getApiFilesUrls(): string[] {
  const { api_folder } = getConfig();

  if (!fs.existsSync(api_folder)) {
    throw new Error(`API folder does not exist: ${api_folder}`);
  }
  if (fs.readdirSync(api_folder).length === 0) {
    throw new Error(`API folder is empty: ${api_folder}`);
  }
  try {
    const api_urls = getApiUrlsFromFiles(api_folder);
    return api_urls;
  } catch (error) {
    throw new Error(`Error extracting API URLs: ${(error as Error).message}`);
  }
}
function getConfig(): TConfig {
  const cwd = process.cwd();
  const theme_name = cwd.split("/").pop() || "unknown_theme";
  const api_folder = path.join(cwd, "api");
  return {
    theme_name,
    api_folder,
  };
}

function getApiUrlsFromFiles(api_folder: string): string[] {
  const files_list = fs.readdirSync(api_folder);
  const files_with_routes: string[] = [];
  // check in each file if have "register_rest_route"

  files_list.forEach((file) => {
    const file_path = path.join(api_folder, file);
    const file_content = fs.readFileSync(file_path, "utf-8");
    if (file_content.includes("register_rest_route")) {
      files_with_routes.push(file_path);
    }
  });
  if (files_with_routes.length === 0) {
    throw new Error(`No API files with routes found in: ${api_folder}`);
  }
  // from each file i need to extract between '' in register route line
  //register_rest_route('products-filter/v1', 'products',
  const api_urls: string[] = [];
  files_with_routes.forEach((file_path) => {
    const file_content = fs.readFileSync(file_path, "utf-8");
    const regex = /register_rest_route\(\s*'([^']+)'/g;
    let match;
    while ((match = regex.exec(file_content)) !== null) {
      api_urls.push(match[1]);
    }
  });
  return api_urls;
}
