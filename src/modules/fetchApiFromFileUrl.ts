import {TApiUrl} from "../custom_types/TApiUrl.js";
import { getWpUrl } from "./getWpUrl.js";

export default async function fetchApiFromFileUrl(url: TApiUrl): Promise<any> {
  const wp_url_raw = getWpUrl();
  const wp_url = wp_url_raw.replace(/\/+$/, ""); // remove trailing slash
  const api_path = url.route.replace(/^\/+/, "");      // remove leading slash
  const api_url = `${wp_url}/wp-json/${api_path}`;

  console.log("api_url", api_url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(api_url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `HTTP ${res.status} ${res.statusText} for ${api_url}` +
        (body ? ` — ${body.slice(0, 300)}` : "")
      );
    }

    const data = await res.json();
    return data; // ✅ returns the parsed JSON (with nested children)
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error(`Request timed out for ${api_url}`);
    }
    throw new Error(`Fetch failed for ${api_url}: ${err?.message || err}`);
  } finally {
    clearTimeout(timer);
  }
}
