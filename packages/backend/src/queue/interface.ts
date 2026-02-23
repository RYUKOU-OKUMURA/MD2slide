import type { JobStatus, JobResult, ExportFormat } from '@md2slide/shared';

/**
 * Internal queue job data structure
 */
export interface QueueJobData {
  id: string;
  markdown: string;
  css?: string;
  format: ExportFormat;
  folderId?: string;
  filename?: string;
  status: JobStatus;
  result?: JobResult;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Job queue interface for enqueueing and managing export jobs.
 * Implementations: InMemoryQueue (Phase 1), Cloud Tasks (Phase 2), BullMQ (Phase 2)
 */
export interface JobQueue {
  /**
   * Enqueue a new job
   * @param data Job data without id, status, and timestamps
   * @returns The generated job ID
   */
  enqueue(data: Omit<QueueJobData, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<string>;

  /**
   * Get the current status of a job
   * @param jobId The job ID to look up
   * @returns The job data or null if not found
   */
  getStatus(jobId: string): Promise<QueueJobData | null>;

  /**
   * Update the status of a job
   * @param jobId The job ID to update
   * @param status The new status
   * @param result Optional result data (for completed jobs)
   * @param errorMessage Optional error message (for failed jobs)
   */
  updateStatus(
    jobId: string,
    status: JobStatus,
    result?: JobResult,
    errorMessage?: string
  ): Promise<void>;

  /**
   * Get the next pending job from the queue (FIFO)
   * @returns The next job data or null if queue is empty
   */
  getNext(): Promise<QueueJobData | null>;

  /**
   * Mark a job as completed with the given result
   * @param jobId The job ID to complete
   * @param result The job result containing URLs
   */
  complete(jobId: string, result: JobResult): Promise<void>;

  /**
   * Mark a job as failed with an error message
   * @param jobId The job ID to fail
   * @param error The error message
   */
  fail(jobId: string, error: string): Promise<void>;
}
