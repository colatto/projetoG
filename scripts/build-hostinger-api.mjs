import { chmodSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const esbuildBin = 'node_modules/.pnpm/esbuild@0.27.7/node_modules/esbuild/bin/esbuild';
const outdir = 'apps/api/dist';

mkdirSync(outdir, { recursive: true });

const pnpmStore = 'node_modules/.pnpm';
for (const entry of existsSync(pnpmStore) ? readdirSync(pnpmStore) : []) {
  if (!entry.startsWith('@esbuild+')) {
    continue;
  }

  const binary = join(pnpmStore, entry, 'node_modules', entry.replace('+', '/'), 'bin', 'esbuild');
  if (existsSync(binary)) {
    chmodSync(binary, 0o755);
  }
}

const result = spawnSync(
  esbuildBin,
  [
    'apps/api/src/server.ts',
    '--bundle',
    '--platform=node',
    '--format=cjs',
    '--target=node20',
    '--define:process.env.HOSTINGER_BUNDLE="1"',
    '--outfile=apps/api/dist/hostinger-entry.js',
  ],
  { stdio: 'inherit' },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

writeFileSync(`${outdir}/package.json`, `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`);
