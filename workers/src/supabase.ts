import ws from 'ws';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@projetog/shared';

let supabaseInstance: SupabaseClient<Database> | null = null;

/**
 * Singleton factory for the Supabase client used by workers.
 * Uses `service_role` key for backend-only access (bypasses RLS).
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!supabaseInstance) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url) {
      throw new Error('SUPABASE_URL is not defined in environment variables.');
    }
    if (!key) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined in environment variables.');
    }

    supabaseInstance = createClient<Database>(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: {
        transport: ws as unknown as typeof WebSocket,
      },
    });
  }

  return supabaseInstance;
}
