import fp from 'fastify-plugin';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@projetog/shared';

declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient<Database>;
  }
}

export interface SupabasePluginOptions {
  url: string;
  serviceRoleKey: string;
}

export const supabasePlugin = fp<SupabasePluginOptions>(async (fastify, opts) => {
  if (!opts.url || !opts.serviceRoleKey) {
    throw new Error('Supabase URL and Service Role Key are required');
  }

  // Utilizar a chave de serviço apenas no backend para bypass de RLS quando necessário pela API,
  // ou para gerenciar usuários (admin auth api).
  const supabase = createClient<Database>(opts.url, opts.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  fastify.decorate('supabase', supabase);
});
