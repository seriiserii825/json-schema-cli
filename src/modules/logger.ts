import chalk from "chalk";

export const info = (...a: unknown[]) => console.log(...a);
export const log = (...a: unknown[]) => console.log(...a);
export const err = (...a: unknown[]) => console.error(...a);

export const info_color = chalk.bold.blue;
export const success_color = chalk.bold.green;
export const error_color = chalk.bold.red;
