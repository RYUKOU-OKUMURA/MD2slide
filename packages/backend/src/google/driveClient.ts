/**
 * Google Drive API Client
 *
 * Provides methods for:
 * - Resumable file uploads (for large files with progress tracking)
 * - Converting PPTX to Google Slides
 * - Getting file metadata
 * - Creating shareable links
 *
 * Security: Never logs full access tokens. Use maskToken from tokenValidator.
 */

import { drive } from 'googleapis/build/src/apis/drive/index.js';
import type { drive_v3 } from 'googleapis/build/src/apis/drive/index.js';
import { Readable } from 'stream';
import { validateTokenFormat, maskToken } from './tokenValidator.js';

/**
 * Options for file upload
 */
export interface UploadOptions {
  /** Name of the file */
  name: string;
  /** MIME type of the file */
  mimeType: string;
  /** File content as Buffer */
  content: Buffer;
  /** Parent folder ID (optional) */
  folderId?: string;
  /** Progress callback for large file uploads */
  onProgress?: (progress: UploadProgress) => void;
}

/**
 * Upload progress information
 */
export interface UploadProgress {
  /** Bytes uploaded so far */
  bytesUploaded: number;
  /** Total bytes to upload */
  totalBytes: number;
  /** Progress percentage (0-100) */
  percentage: number;
}

/**
 * File metadata from Google Drive
 */
export interface DriveFile {
  /** File ID */
  id: string;
  /** File name */
  name: string;
  /** MIME type */
  mimeType: string;
  /** Web view link */
  webViewLink?: string;
  /** Web content link */
  webContentLink?: string;
  /** Parent folder IDs */
  parents?: string[];
}

/**
 * Result of file upload
 */
export interface UploadResult {
  /** Uploaded file ID */
  fileId: string;
  /** File name */
  name: string;
  /** Web view link */
  webViewLink?: string;
}

/**
 * Google Drive API client for file operations
 *
 * Uses the access token provided by the frontend (OAuth PKCE flow).
 * The token is only used in memory and never persisted.
 */
export class DriveClient {
  private drive: drive_v3.Drive;
  private accessToken: string;

  /**
   * Creates a new DriveClient instance
   *
   * @param accessToken - OAuth 2.0 access token from frontend
   * @throws Error if token format is invalid
   */
  constructor(accessToken: string) {
    // Validate token format before use
    if (!validateTokenFormat(accessToken)) {
      throw new Error('Invalid access token format');
    }

    this.accessToken = accessToken;

    // Initialize Drive API client
    this.drive = drive({
      version: 'v3',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log(`[DriveClient] Initialized with token: ${maskToken(accessToken)}`);
  }

  /**
   * Uploads a file to Google Drive using resumable upload
   *
   * For large files, this method:
   * 1. Creates a resumable upload session
   * 2. Uploads the file content in chunks
   * 3. Reports progress via callback
   *
   * @param options - Upload options
   * @returns Upload result with file ID and links
   * @throws Error if upload fails
   */
  async uploadFile(options: UploadOptions): Promise<UploadResult> {
    const { name, mimeType, content, folderId, onProgress } = options;

    console.log(
      `[DriveClient] Starting resumable upload: name=${name}, mimeType=${mimeType}, size=${content.length} bytes`
    );

    try {
      // Prepare file metadata
      const fileMetadata: drive_v3.Schema$File = {
        name,
        parents: folderId ? [folderId] : undefined,
      };

      // For files larger than 5MB, use chunked upload with progress
      const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5MB
      const useProgressCallback = content.length > LARGE_FILE_THRESHOLD && onProgress;

      // Create the file using Drive API
      // Note: googleapis handles resumable uploads automatically for large files
      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: {
          mimeType,
          body: this.createReadableStream(content, useProgressCallback ? onProgress : undefined),
        },
        fields: 'id,name,webViewLink',
      });

      if (!response.data.id) {
        throw new Error('Upload failed: No file ID returned');
      }

      const result: UploadResult = {
        fileId: response.data.id,
        name: response.data.name ?? name,
        webViewLink: response.data.webViewLink ?? undefined,
      };

      console.log(`[DriveClient] Upload completed: fileId=${result.fileId}`);

      // Report 100% completion if progress callback was provided
      if (onProgress) {
        onProgress({
          bytesUploaded: content.length,
          totalBytes: content.length,
          percentage: 100,
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[DriveClient] Upload failed: ${errorMessage}`);
      throw new Error(`Failed to upload file: ${errorMessage}`);
    }
  }

  /**
   * Converts a PPTX file to Google Slides
   *
   * Uses files.copy with target mimeType to convert the uploaded PPTX
   * to a native Google Slides presentation.
   *
   * @param fileId - ID of the PPTX file to convert
   * @param name - Optional name for the converted presentation
   * @returns Converted Slides file metadata
   * @throws Error if conversion fails
   */
  async convertToSlides(fileId: string, name?: string): Promise<DriveFile> {
    console.log(`[DriveClient] Converting PPTX to Slides: fileId=${fileId}`);

    try {
      // Use files.copy with Google Slides mimeType to trigger conversion
      const response = await this.drive.files.copy({
        fileId,
        requestBody: {
          name: name,
          mimeType: 'application/vnd.google-apps.presentation',
        },
        fields: 'id,name,mimeType,webViewLink,parents',
      });

      if (!response.data.id) {
        throw new Error('Conversion failed: No file ID returned');
      }

      const result: DriveFile = {
        id: response.data.id,
        name: response.data.name ?? 'Untitled',
        mimeType: response.data.mimeType ?? 'application/vnd.google-apps.presentation',
        webViewLink: response.data.webViewLink ?? undefined,
        parents: response.data.parents ?? undefined,
      };

      console.log(`[DriveClient] Conversion completed: slidesId=${result.id}`);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[DriveClient] Conversion failed: ${errorMessage}`);
      throw new Error(`Failed to convert to Slides: ${errorMessage}`);
    }
  }

  /**
   * Gets file metadata from Google Drive
   *
   * @param fileId - The file ID
   * @returns File metadata
   * @throws Error if file not found or access denied
   */
  async getFile(fileId: string): Promise<DriveFile> {
    console.log(`[DriveClient] Getting file metadata: fileId=${fileId}`);

    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'id,name,mimeType,webViewLink,webContentLink,parents',
      });

      if (!response.data.id) {
        throw new Error('File not found');
      }

      return {
        id: response.data.id,
        name: response.data.name ?? 'Untitled',
        mimeType: response.data.mimeType ?? 'application/octet-stream',
        webViewLink: response.data.webViewLink ?? undefined,
        webContentLink: response.data.webContentLink ?? undefined,
        parents: response.data.parents ?? undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[DriveClient] Get file failed: ${errorMessage}`);
      throw new Error(`Failed to get file: ${errorMessage}`);
    }
  }

  /**
   * Creates a shareable link for a file
   *
   * Note: This creates a link that anyone with the link can view.
   * For production, consider implementing more granular permission controls.
   *
   * @param fileId - The file ID
   * @returns Shareable web view link
   * @throws Error if sharing fails
   */
  async shareFile(fileId: string): Promise<string> {
    console.log(`[DriveClient] Creating shareable link: fileId=${fileId}`);

    try {
      // Create permission: anyone with link can view
      await this.drive.permissions.create({
        fileId,
        requestBody: {
          type: 'anyone',
          role: 'reader',
        },
      });

      // Get the updated file to retrieve the webViewLink
      const file = await this.getFile(fileId);

      if (!file.webViewLink) {
        throw new Error('Failed to get shareable link');
      }

      console.log(`[DriveClient] Shareable link created: ${file.webViewLink}`);

      return file.webViewLink;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[DriveClient] Share file failed: ${errorMessage}`);
      throw new Error(`Failed to share file: ${errorMessage}`);
    }
  }

  /**
   * Uploads a PPTX file and converts it to Google Slides in one operation
   *
   * This is the main method for the slides export workflow:
   * 1. Upload PPTX file to Drive
   * 2. Convert to Google Slides format
   * 3. Create shareable link
   * 4. Optionally delete the original PPTX
   *
   * @param options - Upload options
   * @param deleteOriginal - Whether to delete the original PPTX after conversion
   * @returns Google Slides URL
   */
  async uploadAndConvertToSlides(
    options: Omit<UploadOptions, 'mimeType'> & { deleteOriginal?: boolean }
  ): Promise<string> {
    const { deleteOriginal = true, ...uploadOptions } = options;

    // Step 1: Upload PPTX
    const uploadResult = await this.uploadFile({
      ...uploadOptions,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });

    try {
      // Step 2: Convert to Slides
      const slidesFile = await this.convertToSlides(
        uploadResult.fileId,
        uploadOptions.name.replace(/\.pptx$/i, '')
      );

      // Step 3: Create shareable link
      const slidesUrl = await this.shareFile(slidesFile.id);

      // Step 4: Delete original PPTX if requested
      if (deleteOriginal) {
        try {
          await this.deleteFile(uploadResult.fileId);
          console.log(`[DriveClient] Deleted original PPTX: ${uploadResult.fileId}`);
        } catch (deleteError) {
          // Log but don't fail if deletion fails
          console.warn(`[DriveClient] Failed to delete original PPTX: ${deleteError}`);
        }
      }

      return slidesUrl;
    } catch (error) {
      // Clean up uploaded file if conversion fails
      try {
        await this.deleteFile(uploadResult.fileId);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Deletes a file from Google Drive
   *
   * @param fileId - The file ID to delete
   * @throws Error if deletion fails
   */
  async deleteFile(fileId: string): Promise<void> {
    console.log(`[DriveClient] Deleting file: fileId=${fileId}`);

    try {
      await this.drive.files.delete({
        fileId,
      });

      console.log(`[DriveClient] File deleted: fileId=${fileId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[DriveClient] Delete file failed: ${errorMessage}`);
      throw new Error(`Failed to delete file: ${errorMessage}`);
    }
  }

  /**
   * Creates a readable stream from a buffer with optional progress tracking
   *
   * @param content - File content as Buffer
   * @param onProgress - Progress callback
   * @returns Readable stream
   */
  private createReadableStream(
    content: Buffer,
    onProgress?: (progress: UploadProgress) => void
  ): NodeJS.ReadableStream {
    const stream = Readable.from(content);

    if (onProgress) {
      let bytesUploaded = 0;
      const totalBytes = content.length;

      stream.on('data', (chunk: Buffer) => {
        bytesUploaded += chunk.length;
        onProgress({
          bytesUploaded,
          totalBytes,
          percentage: Math.round((bytesUploaded / totalBytes) * 100),
        });
      });
    }

    return stream;
  }
}
