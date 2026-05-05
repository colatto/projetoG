import { spawn } from 'node:child_process';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const apiDir = basename(here) === 'dist' ? dirname(here) : here;

const loader = join(apiDir, 'node_modules', 'tsx', 'dist', 'loader.mjs');
const server = join(apiDir, 'src', 'server.ts');

const child = spawn(process.execPath, ['--import', loader, server], {
  env: process.env,
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
