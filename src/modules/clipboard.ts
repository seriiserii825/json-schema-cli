import { execSync } from "node:child_process";

export function readClipboard(): string {
  const cmds = [
    "xclip -selection clipboard -o",
    "wl-paste",
    "pbpaste",
    "xsel -ob",
  ];
  for (const cmd of cmds) {
    try {
      const out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      if (out && out.trim()) return out;
    } catch { /* try next */ }
  }
  throw new Error("No clipboard tool found (xclip / wl-paste / pbpaste / xsel).");
}
