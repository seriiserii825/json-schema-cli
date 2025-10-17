#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Абсолютные пути к локальному tsx и твоему entry
const tsxBin = resolve(__dirname, '../node_modules/.bin/tsx');
const src = resolve(__dirname, '../src/index.ts');

// Запускаем tsx на src/index.ts с наследованием stdio
const child = spawn(tsxBin, [src], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => {
  console.error('[urls-dev] Failed to spawn tsx:', err);
  process.exit(1);
});
