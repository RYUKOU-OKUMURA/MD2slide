import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { existsSync, createReadStream, unlinkSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { JobQueue } from '../queue/interface.js';
import type { ExportFormat, JobStatus, JobResult } from '@md2slide/shared';
import { validateTokenFormat, maskToken } from '../google/index.js';

// Constants
const MAX_MARKDOWN_SIZE = 1024 * 1024; // 1MB

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Zod schemas for validation
const ExportFormatSchema = z.enum(['slides', 'pdf']);

const ExportRequestSchema = z.object({
  markdown: z.string().min(1, 'Markdown content is required'),
  css: z.string().optional(),
  format: ExportFormatSchema,
  folderId: z.string().optional(),
  filename: z.string().optional(),
});

const JobIdParamsSchema = z.object({
  jobId: z.string().regex(UUID_REGEX, 'Invalid job ID format'),
});

// Job queue instance (to be injected)
let jobQueue: JobQueue | null = null;

/**
 * Set the job queue instance for export routes
 */
export function setJobQueue(queue: JobQueue): void {
  jobQueue = queue;
}

/**
 * Get the job queue instance
 */
function getJobQueue(): JobQueue {
  if (!jobQueue) {
    throw new Error('Job queue not initialized. Call setJobQueue() first.');
  }
  return jobQueue;
}

/**
 * Extract access token from Authorization header
 *
 * @param authHeader - The Authorization header value
 * @returns The access token or null if not present/invalid
 */
function extractAccessToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  // Expected format: "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  const token = parts[1];
  if (!validateTokenFormat(token)) {
    return null;
  }

  return token;
}

/**
 * Map queue job data to API response format
 */
function mapJobToResponse(job: {
  id: string;
  status: JobStatus;
  format: ExportFormat;
  createdAt: Date;
  updatedAt: Date;
  result?: JobResult;
  errorMessage?: string;
}) {
  return {
    id: job.id,
    status: job.status,
    format: job.format,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    result: job.result,
    errorMessage: job.errorMessage,
  };
}

// Type definitions for route handlers
interface ExportRequestBody {
  markdown: string;
  css?: string;
  format: ExportFormat;
  folderId?: string;
  filename?: string;
}

interface JobIdParams {
  jobId: string;
}

/**
 * Export routes for MD2slide API
 */
export async function exportRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/export
   * Create a new export job
   */
  fastify.post<{ Body: ExportRequestBody }>('/api/export', async (request, reply) => {
    try {
      // Validate request body
      const parseResult = ExportRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Invalid request body',
        });
      }

      const { markdown, css, format, folderId, filename } = parseResult.data;

      // Validate markdown size
      const markdownSize = Buffer.byteLength(markdown, 'utf-8');
      if (markdownSize > MAX_MARKDOWN_SIZE) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: `Markdown content exceeds maximum size of 1MB (actual: ${(markdownSize / 1024 / 1024).toFixed(2)}MB)`,
        });
      }

      // Validate CSS size if provided
      if (css) {
        const cssSize = Buffer.byteLength(css, 'utf-8');
        if (cssSize > MAX_MARKDOWN_SIZE) {
          return reply.status(400).send({
            code: 'VALIDATION_ERROR',
            message: `CSS content exceeds maximum size of 1MB (actual: ${(cssSize / 1024 / 1024).toFixed(2)}MB)`,
          });
        }
      }

      // Extract and validate access token for slides format
      let accessToken: string | undefined;
      if (format === 'slides') {
        const authHeader = request.headers.authorization;
        accessToken = extractAccessToken(authHeader) ?? undefined;

        if (!accessToken) {
          return reply.status(401).send({
            code: 'UNAUTHORIZED',
            message:
              'Access token is required for Google Slides export. Please provide a valid Authorization header.',
          });
        }

        fastify.log.info(
          `[Export] Access token received for slides export: ${maskToken(accessToken)}`
        );
      }

      const queue = getJobQueue();

      // Create job in queue
      const jobId = await queue.enqueue({
        markdown,
        css,
        format,
        folderId,
        filename,
        accessToken,
      });

      return reply.status(201).send({
        jobId,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to create export job');
      return reply.status(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Failed to create export job',
      });
    }
  });

  /**
   * GET /api/jobs/:jobId/status
   * Get the status of an export job
   */
  fastify.get<{ Params: JobIdParams }>('/api/jobs/:jobId/status', async (request, reply) => {
    try {
      // Validate params
      const parseResult = JobIdParamsSchema.safeParse(request.params);
      if (!parseResult.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Invalid job ID',
        });
      }

      const { jobId } = parseResult.data;
      const queue = getJobQueue();

      const job = await queue.getStatus(jobId);
      if (!job) {
        return reply.status(404).send({
          code: 'JOB_NOT_FOUND',
          message: `Job with ID ${jobId} not found`,
        });
      }

      return reply.status(200).send(mapJobToResponse(job));
    } catch (error) {
      fastify.log.error(error, 'Failed to get job status');
      return reply.status(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Failed to get job status',
      });
    }
  });

  /**
   * GET /api/download/:jobId
   * Download a completed PDF export
   */
  fastify.get<{ Params: JobIdParams }>('/api/download/:jobId', async (request, reply) => {
    try {
      // Validate params
      const parseResult = JobIdParamsSchema.safeParse(request.params);
      if (!parseResult.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Invalid job ID',
        });
      }

      const { jobId } = parseResult.data;
      const queue = getJobQueue();

      const job = await queue.getStatus(jobId);
      if (!job) {
        return reply.status(404).send({
          code: 'JOB_NOT_FOUND',
          message: `Job with ID ${jobId} not found`,
        });
      }

      // Check if job is completed
      if (job.status !== 'done') {
        return reply.status(400).send({
          code: 'JOB_NOT_READY',
          message: `Job is not ready for download (status: ${job.status})`,
        });
      }

      // Check if format is PDF
      if (job.format !== 'pdf') {
        return reply.status(400).send({
          code: 'INVALID_FORMAT',
          message: 'Download is only available for PDF exports. Use slidesUrl for Google Slides.',
        });
      }

      // Check if result has download path
      if (!job.result?.downloadUrl) {
        return reply.status(404).send({
          code: 'FILE_NOT_FOUND',
          message: 'Download file not found',
        });
      }

      const filePath = job.result.downloadUrl;

      // Check if file exists
      if (!existsSync(filePath)) {
        return reply.status(404).send({
          code: 'FILE_NOT_FOUND',
          message: 'Download file not found',
        });
      }

      // Determine filename
      const filename = job.filename || `export-${jobId}`;
      const downloadFilename = `${filename}.pdf`;

      // Set response headers
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="${downloadFilename}"`);
      reply.header('Cache-Control', 'no-store');

      // Stream the file
      const fileStream = createReadStream(filePath);
      await pipeline(fileStream, reply.raw);

      // Delete file after streaming
      try {
        unlinkSync(filePath);
        fastify.log.info({ jobId, filePath }, 'Download file deleted after streaming');
      } catch (deleteError) {
        fastify.log.warn({ deleteError, jobId, filePath }, 'Failed to delete download file');
      }

      return reply;
    } catch (error) {
      fastify.log.error(error, 'Failed to download file');
      return reply.status(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Failed to download file',
      });
    }
  });
}
