import {getWpUrl} from "./getWpUrl.js";

export default async function fetchApiFromFilesUrls(urls: string[]): void {
  const wp_url = getWpUrl();
  console.log("wp_url", wp_url);
  // Placeholder function to fetch API from file URLs
  // Implement the logic to read files from URLs and process them as needed
  console.log("Fetching API from file URLs...");
}
