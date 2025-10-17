import getConfig from "./getConfig.js";
import {getWpUrl} from "./getWpUrl.js";

export default async function fetchApiFromFileUrl(urls: string[]): Promise<void> {
  const wp_url = getWpUrl();
  const config = getConfig();
  console.log("wp_url", wp_url);
  // Placeholder function to fetch API from file URLs
  // Implement the logic to read files from URLs and process them as needed
  console.log("Fetching API from file URLs...");
}
