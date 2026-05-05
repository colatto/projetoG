import { chmodSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const outdir = 'workers/dist';

const bundleArgs = [
  'workers/src/index.ts',
  '--bundle',
  '--platform=node',
  '--format=cjs',
  '--target=node20',
  '--define:process.env.HOSTINGER_BUNDLE="1"',
  '--outfile=workers/dist/hostinger-entry.js',
];

/** `@esbuild+linux-x64@0.27.7` → `@esbuild/linux-x64` (pnpm virtual store layout). */
function pnpmScopedEsbuildFromStoreEntry(entry) {
  if (!entry.startsWith('@esbuild+')) {
    return null;
  }
  const rest = entry.slice('@esbuild+'.length);
  const platform = rest.split('@')[0];
  return join('@esbuild', platform);
}

function chmodNativeBinaries() {
  const pnpmStore = 'node_modules/.pnpm';
  if (!existsSync(pnpmStore)) return;
  for (const entry of readdirSync(pnpmStore)) {
    const scoped = pnpmScopedEsbuildFromStoreEntry(entry);
    if (!scoped) {
      continue;
    }
    const binary = join(pnpmStore, entry, 'node_modules', scoped, 'bin', 'esbuild');
    if (existsSync(binary)) {
      try {
        chmodSync(binary, 0o755);
      } catch {
        // ignore permission errors on exotic filesystems
      }
    }
  }
}

function findNativeEsbuildBinary() {
  const pnpmStore = 'node_modules/.pnpm';
  if (!existsSync(pnpmStore)) return null;
  for (const entry of readdirSync(pnpmStore)) {
    const scoped = pnpmScopedEsbuildFromStoreEntry(entry);
    if (!scoped) {
      continue;
    }
    const binary = join(pnpmStore, entry, 'node_modules', scoped, 'bin', 'esbuild');
    if (existsSync(binary)) {
      return binary;
    }
  }
  return null;
}

function resolveEsbuildWasmCli() {
  try {
    return require.resolve('esbuild-wasm/bin/esbuild');
  } catch {
    return null;
  }
}

function isEaccess(err) {
  return err?.code === 'EACCES' || err?.errno === -13;
}

function runNativeBundle(bin) {
  execFileSync(bin, bundleArgs, { stdio: 'inherit' });
}

function runWasmBundle() {
  const cli = resolveEsbuildWasmCli();
  if (!cli) {
    console.error(
      '[build-hostinger-workers] esbuild-wasm is not installed. Add esbuild-wasm to the workspace root devDependencies.',
    );
    process.exit(1);
  }
  console.warn(
    '[build-hostinger-workers] Using esbuild-wasm (WebAssembly). Suitable when the host denies executing native binaries (e.g. noexec under public_html on shared hosting).',
  );
  const result = spawnSync(process.execPath, [cli, ...bundleArgs], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function writeDistPackageJson() {
  writeFileSync(`${outdir}/package.json`, `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`);
}

function main() {
  mkdirSync(outdir, { recursive: true });
  chmodNativeBinaries();

  if (process.env.HOSTINGER_ESBUILD_WASM === '1') {
    runWasmBundle();
    writeDistPackageJson();
    return;
  }

  const bin = findNativeEsbuildBinary();
  if (!bin) {
    console.warn('[build-hostinger-workers] Native esbuild binary not found; using esbuild-wasm.');
    runWasmBundle();
    writeDistPackageJson();
    return;
  }

  try {
    chmodSync(bin, 0o755);
    execFileSync(bin, ['--version'], { stdio: 'ignore' });
  } catch (e) {
    if (isEaccess(e)) {
      runWasmBundle();
      writeDistPackageJson();
      return;
    }
    throw e;
  }

  try {
    runNativeBundle(bin);
  } catch (e) {
    if (isEaccess(e)) {
      runWasmBundle();
      writeDistPackageJson();
      return;
    }
    if (typeof e.status === 'number') {
      process.exit(e.status);
    }
    throw e;
  }

  writeDistPackageJson();
}

main();
