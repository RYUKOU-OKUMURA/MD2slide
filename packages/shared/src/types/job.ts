/**
 * Job status type for export jobs
 */
export type JobStatus = 'pending' | 'processing' | 'done' | 'error';

/**
 * Export format type
 */
export type ExportFormat = 'slides' | 'pdf';

/**
 * Job result containing URLs for completed exports
 */
export interface JobResult {
  /** Google Slides URL (available when format is 'slides') */
  slidesUrl?: string;
  /** Direct download URL (available when format is 'pdf') */
  downloadUrl?: string;
}

/**
 * Job entity representing an export job
 */
export interface Job {
  /** Unique job identifier */
  id: string;
  /** Current job status */
  status: JobStatus;
  /** Export format */
  format: ExportFormat;
  /** Job creation timestamp (ISO 8601) */
  createdAt: string;
  /** Job last update timestamp (ISO 8601) */
  updatedAt: string;
  /** Job result (available when status is 'done') */
  result?: JobResult;
}
