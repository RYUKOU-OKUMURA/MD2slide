import type { JobQueue } from './interface.js';
import { InMemoryQueue } from './inMemoryQueue.js';

export type { JobQueue, QueueJobData } from './interface.js';
export { InMemoryQueue } from './inMemoryQueue.js';

/**
 * Factory function to create a job queue instance.
 * Currently returns InMemoryQueue for Phase 1 development.
 *
 * Phase 2 will add support for:
 * - Cloud Tasks (Google Cloud)
 * - BullMQ with Redis
 *
 * @returns A JobQueue implementation
 */
export function createQueue(): JobQueue {
  return new InMemoryQueue();
}
