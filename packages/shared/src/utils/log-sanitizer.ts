/**
 * Log sanitizer utility for masking sensitive data before logging.
 * Implements politica-logs.md §3.2.
 *
 * Operates on deep clones — NEVER mutates the original input.
 */

const SENSITIVE_KEYS = new Set([
  'authorization',
  'password',
  'secret',
  'token',
  'api_key',
  'apikey',
  'api_secret',
  'apisecret',
  'service_role_key',
  'supabase_service_role_key',
  'jwt_secret',
  'database_url',
  'access_token',
  'refresh_token',
]);

const EMAIL_REGEX = /^([^@]{1})[^@]*(@.+)$/;
const CPF_REGEX = /^(\d{3})\.(\d{3})\.(\d{3})-(\d{2})$/;
const CNPJ_REGEX = /^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})-(\d{2})$/;
const PHONE_REGEX = /^\((\d{2})\)\s*(\d{4,5})-(\d{4})$/;

/**
 * Recursively sanitizes an object by masking sensitive fields.
 * Fields matched by key name (case-insensitive) or by data pattern.
 *
 * @param obj - The object to sanitize (will NOT be mutated)
 * @returns A deep clone with sensitive data masked
 */
export function sanitizeForLog(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForLog(item));
  }

  const clone: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_KEYS.has(lowerKey)) {
      clone[key] = '***REDACTED***';
    } else if (lowerKey === 'email' && typeof value === 'string') {
      clone[key] = maskEmail(value);
    } else if (lowerKey === 'cpf' && typeof value === 'string') {
      clone[key] = maskCpf(value);
    } else if (lowerKey === 'cnpj' && typeof value === 'string') {
      clone[key] = maskCnpj(value);
    } else if (lowerKey === 'phone' && typeof value === 'string') {
      clone[key] = maskPhone(value);
    } else if (typeof value === 'object' && value !== null) {
      clone[key] = sanitizeForLog(value);
    } else {
      clone[key] = value;
    }
  }

  return clone;
}

/**
 * Masks an email address: `john.doe@example.com` -> `j***@example.com`
 */
export function maskEmail(email: string): string {
  const match = email.match(EMAIL_REGEX);
  if (!match) return '***@***';
  return `${match[1]}***${match[2]}`;
}

/**
 * Masks a CPF: `123.456.789-01` -> `***.***.***-01`
 * Shows only the last 2 digits (verifier).
 */
export function maskCpf(cpf: string): string {
  const match = cpf.match(CPF_REGEX);
  if (!match) return '***.***.***-**';
  return `***.***.***-${match[4]}`;
}

/**
 * Masks a CNPJ, showing only the last 2 digits (verifier).
 * Example: "12.345.678/0001-99" becomes "XX.XXX.XXXX/XXXX-99"
 */
export function maskCnpj(cnpj: string): string {
  const match = cnpj.match(CNPJ_REGEX);
  if (!match) return '**.***.****/****-**';
  return `**.***.****/****-${match[5]}`;
}

/**
 * Masks a phone number: `(11) 99999-1234` -> `(**) *****-1234`
 * Shows only the last 4 digits.
 */
export function maskPhone(phone: string): string {
  const match = phone.match(PHONE_REGEX);
  if (!match) return '(**) *****-****';
  return `(**) *****-${match[3]}`;
}

/**
 * Masks the password component of a database URL.
 * `postgresql://user:secret@host:5432/db` -> `postgresql://user:***@host:5432/db`
 */
export function maskDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch (_e: unknown) {
    void _e;
    return '***DATABASE_URL_REDACTED***';
  }
}

/**
 * Masks a token, showing only the last 8 characters.
 * `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` -> `...XVCJ9==`
 */
export function maskToken(token: string): string {
  if (token.length <= 8) return '***';
  return `...${token.slice(-8)}`;
}
