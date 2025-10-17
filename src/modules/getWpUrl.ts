import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

/** Walk up until we see wp-load.php (WP root), or return null */
function findWpRoot(startDir: string): string | null {
  let dir = path.resolve(startDir);
  const { root } = path.parse(dir);
  while (true) {
    const wpLoad = path.join(dir, "wp-load.php");
    if (fs.existsSync(wpLoad)) return dir;
    if (dir === root) return null;
    dir = path.dirname(dir);
  }
}

export function getWpUrl(startDir = process.cwd()): string {
  const wpRoot =
    findWpRoot(startDir) ??
    // Fallback: if you know you're in LocalWP, jump to /app/public
    (fs.existsSync(path.join(startDir, "wp-content"))
      ? startDir
      : (() => {
          // try common LocalWP layout when run inside theme/plugin
          const upToPublic = startDir.split(path.sep);
          const i = upToPublic.lastIndexOf("app");
          if (i > 0 && upToPublic[i + 1] === "public") {
            return upToPublic.slice(0, i + 2).join(path.sep);
          }
          return null;
        })());

  if (!wpRoot) {
    throw new Error(
      `Could not locate WordPress root from ${startDir}. Try passing --path=/full/path/to/app/public`
    );
  }

  try {
    const out = execFileSync(
      "wp",
      ["option", "get", "siteurl", `--path=${wpRoot}`, "--skip-plugins", "--skip-themes"],
      { encoding: "utf8" }
    ).trim();
    if (!out) throw new Error("Empty siteurl from WP-CLI");
    return out;
  } catch (err: any) {
    // Helpful error with the resolved wpRoot
    throw new Error(
      `WP-CLI failed for --path=${wpRoot}\n${err?.stderr || err?.message || err}`
    );
  }
}
