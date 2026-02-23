/**
 * Job Processor
 *
 * Processes export jobs from the queue:
 * 1. Validates CSS with cssValidator
 * 2. Validates image URLs in markdown with imageUrlValidator
 * 3. Converts with marpConverter
 * 4. For slides format: Uploads to Drive and converts to Google Slides
 * 5. Updates job status (processing -> done/error)
 */

import type { JobQueue, QueueJobData } from '../queue/interface.js';
import { TempFileManager } from './tempFileManager.js';
import { convertMarkdown } from './marpConverter.js';
import { validateCSS } from '../security/cssValidator.js';
import { validateImageUrl } from '../security/imageUrlValidator.js';
import { DriveClient, maskToken } from '../google/index.js';
import { readFile } from 'fs/promises';

/** Default polling interval in milliseconds (1 second) */
const DEFAULT_POLL_INTERVAL_MS = 1000;

/** Regex pattern to match image URLs in Markdown */
const IMAGE_URL_PATTERN = /!\[.*?\]\((.*?)\)/g;

/**
 * Job processor that polls the queue and processes export jobs
 */
export class JobProcessor {
  private queue: JobQueue;
  private tempManager: TempFileManager;
  private pollIntervalMs: number;
  private pollTimer?: NodeJS.Timeout;
  private isRunning = false;
  private isProcessing = false;

  /**
   * Creates a new JobProcessor instance
   *
   * @param queue - The job queue to process
   * @param tempManager - The temp file manager for cleanup
   */
  constructor(queue: JobQueue, tempManager: TempFileManager) {
    this.queue = queue;
    this.tempManager = tempManager;
    this.pollIntervalMs = DEFAULT_POLL_INTERVAL_MS;
    console.log('[JobProcessor] Initialized');
  }

  /**
   * Starts the job processor
   *
   * @param intervalMs - Optional polling interval in milliseconds (default: 1000)
   */
  start(intervalMs?: number): void {
    if (this.isRunning) {
      console.warn('[JobProcessor] Already running');
      return;
    }

    this.pollIntervalMs = intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.isRunning = true;
    console.log(`[JobProcessor] Starting with poll interval: ${this.pollIntervalMs}ms`);

    // Start polling
    this.poll();
  }

  /**
   * Stops the job processor
   */
  stop(): void {
    this.isRunning = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }

    console.log('[JobProcessor] Stopped');
  }

  /**
   * Checks if the processor is currently running
   *
   * @returns True if running
   */
  isProcessorRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Main polling loop
   */
  private poll(): void {
    if (!this.isRunning) {
      return;
    }

    this.pollTimer = setTimeout(async () => {
      if (!this.isRunning) {
        return;
      }

      // Only process one job at a time
      if (!this.isProcessing) {
        await this.processNextJob();
      }

      // Continue polling
      this.poll();
    }, this.pollIntervalMs);
  }

  /**
   * Processes the next job in the queue
   */
  private async processNextJob(): Promise<void> {
    this.isProcessing = true;

    try {
      const job = await this.queue.getNext();

      if (!job) {
        // No jobs available
        return;
      }

      console.log(`[JobProcessor] Processing job: ${job.id}, format: ${job.format}`);

      // Process the job
      await this.process(job);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[JobProcessor] Error in processNextJob:', errorMessage);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Processes a single job
   *
   * @param job - The job to process
   */
  async process(job: QueueJobData): Promise<void> {
    const jobId = job.id;

    try {
      console.log(`[JobProcessor] Starting processing for job ${jobId}`);

      // Update status to processing
      await this.queue.updateStatus(jobId, 'processing');

      // Step 1: Validate CSS if provided
      if (job.css) {
        console.log(`[JobProcessor] Validating CSS for job ${jobId}`);
        const cssValidation = validateCSS(job.css);

        if (!cssValidation.valid) {
          const errorMsg = `CSS validation failed: ${cssValidation.errors.join('; ')}`;
          console.error(`[JobProcessor] ${errorMsg}`);
          await this.queue.fail(jobId, errorMsg);
          return;
        }
        console.log(`[JobProcessor] CSS validation passed for job ${jobId}`);
      }

      // Step 2: Validate image URLs in markdown
      console.log(`[JobProcessor] Validating image URLs for job ${jobId}`);
      const imageUrls = this.extractImageURLs(job.markdown);

      if (imageUrls.length > 0) {
        console.log(`[JobProcessor] Found ${imageUrls.length} image URLs to validate`);

        for (const url of imageUrls) {
          const urlValidation = await validateImageUrl(url);

          if (!urlValidation.valid) {
            const errorMsg = `Image URL validation failed for "${url}": ${urlValidation.error}`;
            console.error(`[JobProcessor] ${errorMsg}`);
            await this.queue.fail(jobId, errorMsg);
            return;
          }
        }
        console.log(`[JobProcessor] All image URLs validated for job ${jobId}`);
      }

      // Step 3: Validate access token for slides format
      if (job.format === 'slides') {
        if (!job.accessToken) {
          const errorMsg = 'Access token is required for slides export';
          console.error(`[JobProcessor] ${errorMsg}`);
          await this.queue.fail(jobId, errorMsg);
          return;
        }
        console.log(
          `[JobProcessor] Access token provided for slides export: ${maskToken(job.accessToken)}`
        );
      }

      // Step 4: Create temp file and convert
      const extension = job.format === 'pdf' ? 'pdf' : 'pptx';
      const { path: outputPath } = await this.tempManager.createTempFile(extension);

      // Schedule cleanup for the output file
      this.tempManager.scheduleCleanup(outputPath);

      try {
        console.log(`[JobProcessor] Converting markdown for job ${jobId}`);
        const result = await convertMarkdown(job.markdown, job.css, job.format, outputPath);

        if (!result.success) {
          const errorMsg = result.error ?? 'Conversion failed with unknown error';
          console.error(`[JobProcessor] Conversion failed for job ${jobId}: ${errorMsg}`);
          await this.queue.fail(jobId, errorMsg);
          return;
        }

        console.log(
          `[JobProcessor] Conversion successful for job ${jobId}, output: ${result.outputPath}`
        );

        // Step 5: Handle format-specific post-processing
        let jobResult: { slidesUrl?: string; downloadUrl?: string };

        if (job.format === 'slides' && job.accessToken) {
          // Upload to Drive and convert to Slides
          jobResult = await this.processSlidesExport(
            result.outputPath ?? outputPath,
            job.filename ?? 'presentation',
            job.folderId,
            job.accessToken
          );
        } else {
          // PDF: Return download URL
          jobResult = this.buildJobResult(job.format, result.outputPath ?? outputPath);
        }

        await this.queue.complete(jobId, jobResult);
        console.log(`[JobProcessor] Job ${jobId} completed successfully`);
      } finally {
        // Note: We don't cleanup the output file immediately as it might be needed
        // for download. The scheduled cleanup will handle it.
        // If the job completed successfully, the file will be cleaned up after the max age.
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[JobProcessor] Unexpected error processing job ${jobId}:`, errorMessage);
      await this.queue.fail(jobId, `Internal error: ${errorMessage}`);
    }
  }

  /**
   * Processes slides export: Upload PPTX to Drive and convert to Slides
   *
   * @param pptxPath - Path to the generated PPTX file
   * @param filename - Desired filename (without extension)
   * @param folderId - Target folder ID (optional)
   * @param accessToken - OAuth access token
   * @returns Job result with slidesUrl
   */
  private async processSlidesExport(
    pptxPath: string,
    filename: string,
    folderId: string | undefined,
    accessToken: string
  ): Promise<{ slidesUrl: string }> {
    console.log(`[JobProcessor] Processing slides export: path=${pptxPath}, filename=${filename}`);

    // Read the PPTX file
    const fileContent = await readFile(pptxPath);
    console.log(`[JobProcessor] PPTX file read: ${fileContent.length} bytes`);

    // Create Drive client with the provided access token
    const driveClient = new DriveClient(accessToken);

    // Upload to Drive and convert to Slides
    const slidesUrl = await driveClient.uploadAndConvertToSlides({
      name: `${filename}.pptx`,
      content: fileContent,
      folderId,
      deleteOriginal: true,
    });

    console.log(`[JobProcessor] Slides export completed: ${slidesUrl}`);

    return { slidesUrl };
  }

  /**
   * Extracts image URLs from Markdown content
   *
   * @param markdown - The Markdown content
   * @returns Array of image URLs
   */
  private extractImageURLs(markdown: string): string[] {
    const urls: string[] = [];
    let match: RegExpExecArray | null;

    // Reset regex state
    IMAGE_URL_PATTERN.lastIndex = 0;

    while ((match = IMAGE_URL_PATTERN.exec(markdown)) !== null) {
      const url = match[1].trim();

      // Skip data URIs and relative paths (they don't need SSRF validation)
      if (url.startsWith('data:') || url.startsWith('/') || url.startsWith('./')) {
        continue;
      }

      // Skip empty URLs
      if (url.length === 0) {
        continue;
      }

      urls.push(url);
    }

    return urls;
  }

  /**
   * Builds the job result based on format and output path
   *
   * @param format - Export format
   * @param outputPath - Path to the output file
   * @returns Job result with appropriate URL
   */
  private buildJobResult(
    format: string,
    outputPath: string
  ): { slidesUrl?: string; downloadUrl?: string } {
    // In a production environment:
    // - For PDF: Upload to cloud storage and return public URL
    // - For Slides: Upload to Google Drive and convert, return Slides URL

    // For now, return local file path as download URL
    // This will be replaced by actual upload logic in later phases
    if (format === 'pdf') {
      return {
        downloadUrl: `file://${outputPath}`,
      };
    } else {
      return {
        slidesUrl: `file://${outputPath}`,
      };
    }
  }
}
