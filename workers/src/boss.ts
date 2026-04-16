import PgBoss from 'pg-boss';
import 'dotenv/config';

let bossInstance: PgBoss | null = null;

/**
 * Singleton factory for the pg-boss instance.
 * Configured with retention policies per politica-logs.md §5.2.
 */
export function getBoss(): PgBoss {
  if (!bossInstance) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined in environment variables.');
    }

    bossInstance = new PgBoss({
      connectionString,
      // Retention configuration per politica-logs.md §5.2
      archiveCompletedAfterSeconds: 43_200, // 12h — move completed jobs to archive
      deleteAfterDays: 90, // 90 days — clean archive
    });

    bossInstance.on('error', (error) => {
      console.error('[pg-boss] Fatal error:', error);
    });
  }

  return bossInstance;
}
