import {
  createSiengeClient,
  SiengeClient,
  decryptSiengeCredential,
} from '@projetog/integration-sienge';
import type { SupabaseClient } from '@supabase/supabase-js';

interface CachedClient {
  client: SiengeClient;
  expiresAt: number;
}

let cachedSiengeInstance: CachedClient | null = null;
const CACHE_TTL_MS = 60_000;

/**
 * Singleton factory for the Sienge client used by workers.
 * Reads credentials dynamically from the database with a 60-second TTL cache.
 * Falls back to environment variables in development only.
 */
export async function getSiengeClient(supabase: SupabaseClient): Promise<SiengeClient> {
  const now = Date.now();
  if (cachedSiengeInstance && cachedSiengeInstance.expiresAt > now) {
    return cachedSiengeInstance.client;
  }

  const { data: creds, error } = await supabase
    .from('sienge_credentials')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(`[getSiengeClient] Failed to fetch credentials: ${error.message}`);
  }

  let client: SiengeClient;

  if (creds) {
    const apiKey = decryptSiengeCredential(creds.api_user);
    const apiSecret = decryptSiengeCredential(creds.api_password);

    // The PRD indicates subdomain structure is: https://<subdomain>.sienge.com.br/api/v1
    const baseUrl = `https://${creds.subdomain}.sienge.com.br/api/v1`;

    client = createSiengeClient(
      {
        SIENGE_BASE_URL: baseUrl,
        SIENGE_API_KEY: apiKey,
        SIENGE_API_SECRET: apiSecret,
      },
      {
        restPerMinute: creds.rest_rate_limit,
        bulkPerMinute: creds.bulk_rate_limit,
      },
    );
  } else {
    // Fallback logic
    if (process.env.NODE_ENV === 'development') {
      console.info(
        '[getSiengeClient] No active credentials found in database. Using development fallback (process.env).',
      );
      client = createSiengeClient({
        SIENGE_BASE_URL: process.env.SIENGE_BASE_URL,
        SIENGE_API_KEY: process.env.SIENGE_API_KEY,
        SIENGE_API_SECRET: process.env.SIENGE_API_SECRET,
      });
    } else {
      throw new Error('Missing active Sienge credentials in the database (sienge_credentials).');
    }
  }

  cachedSiengeInstance = {
    client,
    expiresAt: now + CACHE_TTL_MS,
  };

  return client;
}
