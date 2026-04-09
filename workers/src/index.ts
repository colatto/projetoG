import { getBoss } from './boss.js';
import { registerHandlers } from './handlers/index.js';
import 'dotenv/config';

async function start() {
  console.log('Worker process starting...');
  
  try {
    const boss = getBoss();
    
    // start() checks if pgboss schema exists, creates it if not, and starts the internal queues
    await boss.start();
    console.log('pg-boss started successfully.');

    // Register handlers where jobs hook up to processor functions
    await registerHandlers(boss);
    
    console.log('Worker is now listening for jobs.');
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Received SIGINT. Shutting down worker...');
      await boss.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start worker:', error);
    process.exit(1);
  }
}

start();
