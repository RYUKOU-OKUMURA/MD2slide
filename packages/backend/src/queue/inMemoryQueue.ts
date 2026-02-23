import { v4 as uuidv4 } from 'uuid';
import type { JobStatus, JobResult } from '@md2slide/shared';
import type { JobQueue, QueueJobData } from './interface.js';

/**
 * In-memory implementation of the JobQueue interface.
 * Uses Map for O(1) lookups and an array for FIFO queue processing.
 *
 * Note: This implementation is suitable for single-instance deployments.
 * For distributed systems, use Cloud Tasks or BullMQ implementations.
 */
export class InMemoryQueue implements JobQueue {
  private jobs: Map<string, QueueJobData> = new Map();
  private queue: string[] = [];

  async enqueue(
    data: Omit<QueueJobData, 'id' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const id = uuidv4();
    const now = new Date();

    const job: QueueJobData = {
      ...data,
      id,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(id, job);
    this.queue.push(id);

    return id;
  }

  async getStatus(jobId: string): Promise<QueueJobData | null> {
    return this.jobs.get(jobId) ?? null;
  }

  async updateStatus(
    jobId: string,
    status: JobStatus,
    result?: JobResult,
    errorMessage?: string
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    job.status = status;
    job.updatedAt = new Date();

    if (result !== undefined) {
      job.result = result;
    }

    if (errorMessage !== undefined) {
      job.errorMessage = errorMessage;
    }
  }

  async getNext(): Promise<QueueJobData | null> {
    while (this.queue.length > 0) {
      const jobId = this.queue.shift()!;
      const job = this.jobs.get(jobId);

      if (job && job.status === 'pending') {
        return job;
      }
    }

    return null;
  }

  async complete(jobId: string, result: JobResult): Promise<void> {
    await this.updateStatus(jobId, 'done', result);
  }

  async fail(jobId: string, error: string): Promise<void> {
    await this.updateStatus(jobId, 'error', undefined, error);
  }
}
