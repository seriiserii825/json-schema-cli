import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = createInterface({ input, output });

export async function ask(question: string, def: string): Promise<string> {
  const ans = (await rl.question(`${question} [${def}]: `)).trim();
  return ans || def;
}

export function closePrompts() {
  rl.close();
}
