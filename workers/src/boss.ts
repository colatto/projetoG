import PgBoss from 'pg-boss';
import 'dotenv/config';

let bossInstance: PgBoss | null = null;

export function getBoss(): PgBoss {
  if (!bossInstance) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined in environment variables.');
    }

    // Initialize PgBoss with the Postgres connection URI.
    bossInstance = new PgBoss(connectionString);

    bossInstance.on('error', (error) => {
      console.error('pg-boss error:', error);
    });
  }

  return bossInstance;
}
