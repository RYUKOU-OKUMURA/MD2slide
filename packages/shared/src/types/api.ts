import type { ExportFormat, JobStatus, JobResult } from './job.js';

/**
 * Request body for export API
 */
export interface ExportRequest {
  /** Markdown content to convert */
  markdown: string;
  /** Optional custom CSS styles */
  css?: string;
  /** Export format: 'slides' for Google Slides, 'pdf' for PDF */
  format: ExportFormat;
  /** Target Google Drive folder ID (only for 'slides' format) */
  folderId?: string;
  /** Output filename (without extension) */
  filename?: string;
}

/**
 * Response for export API job creation
 */
export interface ExportResponse {
  /** Created job ID */
  jobId: string;
}

/**
 * Response for job status API
 */
export interface JobStatusResponse {
  /** Job ID */
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
  /** Error message (available when status is 'error') */
  errorMessage?: string;
}

/**
 * API error response
 */
export interface ApiError {
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
}

// Re-export job types for convenience
export type { Job, JobStatus, JobResult, ExportFormat } from './job.js';
