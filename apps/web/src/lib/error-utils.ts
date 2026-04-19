import { AxiosError } from 'axios';

/**
 * Extracts a user-facing error message from an unknown catch value.
 * Safely handles AxiosError responses from the API.
 */
export function getApiErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof AxiosError) {
    const data = e.response?.data as Record<string, unknown> | undefined;
    const message = data?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

/**
 * Type guard for AxiosError — useful when the caller needs
 * access to response status or other Axios-specific fields.
 */
export function isAxiosError(e: unknown): e is AxiosError {
  return e instanceof AxiosError;
}
