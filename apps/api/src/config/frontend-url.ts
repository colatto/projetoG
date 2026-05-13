const DEFAULT_FRONTEND_URL = 'http://localhost:5173';

export function getFrontendUrl() {
  return (process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL).replace(/\/+$/, '');
}

export function getPasswordRedirectUrl() {
  return `${getFrontendUrl()}/reset-password`;
}
