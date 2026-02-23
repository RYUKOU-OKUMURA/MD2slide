/**
 * Temporary File Manager
 *
 * Manages the lifecycle of temporary files created during conversion jobs.
 * Provides immediate cleanup via returned cleanup functions and
 * batch cleanup for orphaned files.
 */

import { mkdir, unlink, readdir, stat, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';

/**
 * Information about a tracked temporary file
 */
interface TempFileInfo {
  /** Absolute path to the file */
  path: string;
  /** Timestamp when the file was created */
  createdAt: number;
  /** Timer for scheduled cleanup (if any) */
  cleanupTimer?: NodeJS.Timeout;
}

/** Default maximum age for temporary files (30 minutes) */
const DEFAULT_MAX_AGE_MS = 30 * 60 * 1000;

/** Default batch cleanup interval (5 minutes) */
const DEFAULT_BATCH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Manages temporary files for conversion jobs
 *
 * Features:
 * - Creates unique temp files with configurable extensions
 * - Provides immediate cleanup via returned cleanup functions
 * - Schedules automatic cleanup for files after a maximum age
 * - Runs batch cleanup to remove orphaned files
 */
export class TempFileManager {
  private tempDir: string;
  private trackedFiles: Map<string, TempFileInfo> = new Map();
  private batchCleanupTimer?: NodeJS.Timeout;
  private isRunning = false;

  /**
   * Creates a new TempFileManager instance
   *
   * @param baseDir - Optional base directory for temp files (defaults to os.tmpdir())
   */
  constructor(baseDir?: string) {
    // Use provided base directory or system temp directory
    this.tempDir = baseDir ?? join(tmpdir(), 'md2slide');
    console.log(`[TempFileManager] Initialized with temp directory: ${this.tempDir}`);
  }

  /**
   * Ensures the temp directory exists
   */
  private async ensureTempDir(): Promise<void> {
    if (!existsSync(this.tempDir)) {
      await mkdir(this.tempDir, { recursive: true });
    }
  }

  /**
   * Creates a new temporary file
   *
   * @param extension - File extension (without leading dot, e.g., 'pdf', 'pptx')
   * @returns Object containing the file path and a cleanup function
   */
  async createTempFile(
    extension: string
  ): Promise<{ path: string; cleanup: () => Promise<void> }> {
    await this.ensureTempDir();

    // Generate unique filename using UUID
    const filename = `md2slide-${randomUUID()}.${extension}`;
    const filePath = join(this.tempDir, filename);

    // Track the file
    const fileInfo: TempFileInfo = {
      path: filePath,
      createdAt: Date.now(),
    };
    this.trackedFiles.set(filePath, fileInfo);

    console.log(`[TempFileManager] Created temp file: ${filePath}`);

    // Return path and cleanup function
    return {
      path: filePath,
      cleanup: () => this.cleanupFile(filePath),
    };
  }

  /**
   * Cleans up a specific file
   *
   * @param filePath - Path to the file to clean up
   */
  private async cleanupFile(filePath: string): Promise<void> {
    const fileInfo = this.trackedFiles.get(filePath);

    try {
      if (existsSync(filePath)) {
        await unlink(filePath);
        console.log(`[TempFileManager] Cleaned up file: ${filePath}`);
      }
    } catch (err) {
      console.warn(`[TempFileManager] Failed to cleanup file ${filePath}:`, err);
    } finally {
      // Remove from tracking regardless of cleanup success
      if (fileInfo) {
        // Clear any scheduled cleanup timer
        if (fileInfo.cleanupTimer) {
          clearTimeout(fileInfo.cleanupTimer);
        }
        this.trackedFiles.delete(filePath);
      }
    }
  }

  /**
   * Schedules a file for cleanup after a maximum age
   *
   * @param filePath - Path to the file to schedule for cleanup
   * @param maxAgeMs - Maximum age in milliseconds (default: 30 minutes)
   */
  scheduleCleanup(filePath: string, maxAgeMs: number = DEFAULT_MAX_AGE_MS): void {
    const fileInfo = this.trackedFiles.get(filePath);
    if (!fileInfo) {
      console.warn(`[TempFileManager] Cannot schedule cleanup for untracked file: ${filePath}`);
      return;
    }

    // Clear any existing timer
    if (fileInfo.cleanupTimer) {
      clearTimeout(fileInfo.cleanupTimer);
    }

    // Schedule cleanup
    fileInfo.cleanupTimer = setTimeout(async () => {
      console.log(`[TempFileManager] Scheduled cleanup triggered for: ${filePath}`);
      await this.cleanupFile(filePath);
    }, maxAgeMs);

    console.log(`[TempFileManager] Scheduled cleanup for ${filePath} in ${maxAgeMs / 1000}s`);
  }

  /**
   * Starts the batch cleanup process that periodically removes old temp files
   *
   * @param intervalMs - Interval between cleanup runs in milliseconds (default: 5 minutes)
   */
  startBatchCleanup(intervalMs: number = DEFAULT_BATCH_INTERVAL_MS): void {
    if (this.isRunning) {
      console.warn('[TempFileManager] Batch cleanup is already running');
      return;
    }

    this.isRunning = true;
    console.log(`[TempFileManager] Starting batch cleanup every ${intervalMs / 1000}s`);

    // Run immediately
    this.runBatchCleanup().catch((err) => {
      console.error('[TempFileManager] Batch cleanup error:', err);
    });

    // Schedule periodic cleanup
    this.batchCleanupTimer = setInterval(async () => {
      await this.runBatchCleanup().catch((err) => {
        console.error('[TempFileManager] Batch cleanup error:', err);
      });
    }, intervalMs);
  }

  /**
   * Stops the batch cleanup process
   */
  stopBatchCleanup(): void {
    if (this.batchCleanupTimer) {
      clearInterval(this.batchCleanupTimer);
      this.batchCleanupTimer = undefined;
    }
    this.isRunning = false;
    console.log('[TempFileManager] Stopped batch cleanup');
  }

  /**
   * Runs a single batch cleanup to remove old temporary files
   *
   * Removes files older than the maximum age from the temp directory.
   */
  private async runBatchCleanup(): Promise<void> {
    const now = Date.now();
    let cleanedCount = 0;

    try {
      await this.ensureTempDir();

      const files = await readdir(this.tempDir);

      for (const filename of files) {
        // Only process files matching our pattern
        if (!filename.startsWith('md2slide-')) {
          continue;
        }

        const filePath = join(this.tempDir, filename);

        try {
          const fileStat = await stat(filePath);
          const fileAge = now - fileStat.birthtimeMs;

          // Delete files older than max age
          if (fileAge > DEFAULT_MAX_AGE_MS) {
            await rm(filePath, { force: true });
            cleanedCount++;
            console.log(`[TempFileManager] Batch cleanup removed old file: ${filePath}`);
          }
        } catch (err) {
          // File might have been deleted already, ignore
        }
      }

      if (cleanedCount > 0) {
        console.log(`[TempFileManager] Batch cleanup completed, removed ${cleanedCount} old files`);
      }
    } catch (err) {
      console.error('[TempFileManager] Batch cleanup failed:', err);
    }
  }

  /**
   * Cleans up all tracked files immediately
   *
   * Useful for shutdown cleanup.
   */
  async cleanupAll(): Promise<void> {
    console.log(`[TempFileManager] Cleaning up all ${this.trackedFiles.size} tracked files`);

    const cleanupPromises: Promise<void>[] = [];

    for (const filePath of this.trackedFiles.keys()) {
      cleanupPromises.push(this.cleanupFile(filePath));
    }

    await Promise.allSettled(cleanupPromises);
    this.trackedFiles.clear();
  }

  /**
   * Gets the number of currently tracked files
   *
   * @returns Number of tracked files
   */
  getTrackedFileCount(): number {
    return this.trackedFiles.size;
  }

  /**
   * Checks if batch cleanup is currently running
   *
   * @returns True if batch cleanup is running
   */
  isBatchCleanupRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Gets the temp directory path
   *
   * @returns The temp directory path
   */
  getTempDir(): string {
    return this.tempDir;
  }
}
