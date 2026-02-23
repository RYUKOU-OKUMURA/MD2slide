import type { FastifyInstance } from 'fastify';
import { exportRoutes, setJobQueue } from './export.js';
import { healthRoutes } from './health.js';
import type { JobQueue } from '../queue/interface.js';

// Re-export setJobQueue for external use
export { setJobQueue };

/**
 * Register all API routes with the Fastify instance
 * @param app - The Fastify application instance
 * @param queue - Optional job queue instance for export routes
 */
export async function registerRoutes(app: FastifyInstance, queue?: JobQueue): Promise<void> {
  // Set up job queue if provided
  if (queue) {
    setJobQueue(queue);
  }

  // Register health check routes (no prefix, already has /health endpoint)
  await app.register(healthRoutes);

  // Register export routes
  await app.register(exportRoutes);
}
