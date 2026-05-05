import fp from 'fastify-plugin';
import ws from 'ws';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@projetog/shared';

declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient<Database>;
    supabaseAuth: SupabaseClient<Database>;
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

  const clientOpts = {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      transport: ws as unknown as typeof WebSocket,
    },
  };

  // Client principal para operações de dados — service_role puro, nunca contaminado por auth.
  // signInWithPassword() NUNCA deve ser chamado neste client, pois altera a sessão interna
  // e faz com que queries posteriores usem o token do usuário em vez do service_role,
  // quebrando silenciosamente o bypass de RLS.
  const supabase = createClient<Database>(opts.url, opts.serviceRoleKey, clientOpts);

  // Client separado exclusivo para operações de autenticação (login, signup, resetPassword).
  // signInWithPassword() contamina a sessão interna do client, então isolamos esse
  // comportamento num client dedicado para que o client principal não seja afetado.
  const supabaseAuth = createClient<Database>(opts.url, opts.serviceRoleKey, clientOpts);

  fastify.decorate('supabase', supabase);
  fastify.decorate('supabaseAuth', supabaseAuth);
});
