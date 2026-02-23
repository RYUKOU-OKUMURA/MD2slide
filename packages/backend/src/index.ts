import { createServer, startServer } from './server.js';
import { config } from './config.js';

const gracefulShutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

async function main(): Promise<void> {
  const app = await createServer();

  // Handle graceful shutdown
  for (const signal of gracefulShutdownSignals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);
      try {
        await app.close();
        app.log.info('Server closed successfully');
        process.exit(0);
      } catch (err) {
        app.log.error(err, 'Error during graceful shutdown');
        process.exit(1);
      }
    });
  }

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    app.log.fatal(err, 'Uncaught exception');
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    app.log.fatal({ reason, promise }, 'Unhandled promise rejection');
    process.exit(1);
  });

  await startServer(app);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
