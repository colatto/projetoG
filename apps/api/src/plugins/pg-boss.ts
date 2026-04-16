import fp from 'fastify-plugin';
import PgBoss from 'pg-boss';

export interface JobPublisher {
  send: PgBoss['send'];
}

declare module 'fastify' {
  interface FastifyInstance {
    boss: JobPublisher | null;
  }
}

export interface PgBossPluginOptions {
  connectionString: string;
}

/**
 * Fastify plugin that provides a pg-boss instance for job enqueuing.
 * This is a "send-only" instance — only boss.send() is used.
 * Workers handle boss.start() + boss.work() in their own process.
 *
 * Requires DATABASE_URL environment variable.
 * PRD-07 §6.5, fronteira-integracao.md §6
 */
export const pgBossPlugin = fp<PgBossPluginOptions>(async (fastify, opts) => {
  if (!opts.connectionString) {
    throw new Error('DATABASE_URL is required for pg-boss plugin');
  }

  const boss = new PgBoss({
    connectionString: opts.connectionString,
    // Retention configuration per politica-logs.md §5.2
    archiveCompletedAfterSeconds: 43_200, // 12h
    deleteAfterDays: 90,
  });

  boss.on('error', (error) => {
    fastify.log.error({ err: error, context: 'pgBossPlugin' }, 'pg-boss error');
  });

  fastify.decorate('boss', boss);
  fastify.log.info('pg-boss initialized in send-only mode (API)');

  fastify.addHook('onClose', async () => {
    await boss.stop();
    fastify.log.info('pg-boss stopped (API)');
  });
});
