import { execFileSync } from 'node:child_process';

const ALLOWED_SUFFIXES = ['.example', '.md', '.txt'];
const BLOCKED_PATH_PATTERNS = [
  /(^|\/)\.env($|\.)/i,
  /(^|\/)\.envrc$/i,
  /(^|\/).*\.pem$/i,
  /(^|\/).*\.key$/i,
  /(^|\/)id_(rsa|ed25519)$/i,
];
const ALLOWED_PATH_PATTERNS = [/\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/, /(^|\/)__tests__\//];

const SECRET_PATTERNS = [
  {
    name: 'supabase-service-role',
    pattern:
      /\bSUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!.*(?:placeholder|example|changeme|redacted|test))/i,
  },
  {
    name: 'jwt-secret',
    pattern: /\bJWT_SECRET\s*=\s*(?!.*(?:placeholder|example|changeme|redacted))/i,
  },
  {
    name: 'database-url-with-password',
    pattern: /\bDATABASE_URL\s*=\s*postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i,
  },
  { name: 'private-key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    name: 'api-secret',
    pattern:
      /\b(?:SIENGE_API_SECRET|API_SECRET|SECRET_KEY|ACCESS_TOKEN|REFRESH_TOKEN)\s*=\s*(?!.*(?:placeholder|example|changeme|redacted))/i,
  },
];

function runGit(args) {
  return execFileSync('git', args, { encoding: 'utf8' });
}

function getStagedFiles() {
  const output = runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
  return output
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);
}

function isAllowedExample(file) {
  return ALLOWED_SUFFIXES.some((suffix) => file.endsWith(suffix));
}

function isBlockedPath(file) {
  if (isAllowedExample(file)) {
    return false;
  }

  return BLOCKED_PATH_PATTERNS.some((pattern) => pattern.test(file));
}

function readStagedFile(file) {
  try {
    return runGit(['show', `:${file}`]);
  } catch {
    return '';
  }
}

function detectSecret(content) {
  return SECRET_PATTERNS.find(({ pattern }) => pattern.test(content))?.name ?? null;
}

const stagedFiles = getStagedFiles();
const findings = [];

for (const file of stagedFiles) {
  if (isBlockedPath(file)) {
    findings.push(`${file}: arquivo sensível não deve ser commitado`);
    continue;
  }
  if (isAllowedExample(file)) continue;
  if (ALLOWED_PATH_PATTERNS.some((p) => p.test(file))) continue; // <-- novo
  const content = readStagedFile(file);

  const detectedSecret = detectSecret(content);
  if (detectedSecret) {
    findings.push(`${file}: padrão sensível detectado (${detectedSecret})`);
  }
}

if (findings.length > 0) {
  console.error('Commit bloqueado pelo scanner de secrets.');
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  console.error(
    'Remova o segredo, mova-o para variáveis de ambiente do sistema e tente novamente.',
  );
  process.exit(1);
}

console.log('Scanner de secrets: nenhum segredo detectado nos arquivos staged.');
