/**
 * Marp CLI wrapper for converting Markdown to PDF/PPTX
 *
 * Handles conversion of Markdown content using marp-cli via child_process.
 * Supports PDF and PPTX output formats with configurable timeout.
 */

import { spawn } from 'child_process';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import type { ExportFormat } from '@md2slide/shared';

/**
 * Result of a Markdown conversion operation
 */
export interface ConversionResult {
  /** Whether the conversion was successful */
  success: boolean;
  /** Path to the output file (available on success) */
  outputPath?: string;
  /** Error message (available on failure) */
  error?: string;
}

/** Default conversion timeout in milliseconds (3 minutes) */
const DEFAULT_TIMEOUT_MS = 180000;

/** Maximum output buffer size (10MB) */
const MAX_BUFFER_SIZE = 10 * 1024 * 1024;

/**
 * Converts Markdown content to PDF or PPTX using marp-cli
 *
 * @param markdown - The Markdown content to convert
 * @param css - Optional custom CSS styles
 * @param format - Output format ('pdf' or 'slides')
 * @param outputPath - Path where the output file should be written
 * @param timeoutMs - Optional timeout in milliseconds (default: 180000)
 * @returns ConversionResult indicating success/failure and output path
 */
export async function convertMarkdown(
  markdown: string,
  css: string | undefined,
  format: ExportFormat,
  outputPath: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<ConversionResult> {
  let inputPath: string | null = null;

  try {
    // Ensure output directory exists
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    // Prepare Markdown content with optional CSS
    const fullMarkdown = css ? embedCSS(markdown, css) : markdown;

    // Create temporary input file
    inputPath = join(outputDir, `input-${Date.now()}.md`);
    await writeFile(inputPath, fullMarkdown, 'utf-8');

    console.log(`[marpConverter] Starting conversion: format=${format}, input=${inputPath}, output=${outputPath}`);

    // Run marp-cli
    const result = await runMarpCLI(inputPath, outputPath, format, timeoutMs);

    if (result.success) {
      console.log(`[marpConverter] Conversion completed successfully: ${outputPath}`);
    } else {
      console.error(`[marpConverter] Conversion failed: ${result.error}`);
    }

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[marpConverter] Conversion error: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage,
    };
  } finally {
    // Clean up input file
    if (inputPath) {
      try {
        await unlink(inputPath);
        console.log(`[marpConverter] Cleaned up input file: ${inputPath}`);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Embeds CSS into Markdown content using Marp's style directive
 *
 * @param markdown - The Markdown content
 * @param css - The CSS styles to embed
 * @returns Markdown with embedded CSS
 */
function embedCSS(markdown: string, css: string): string {
  // Use Marp's style directive to embed CSS
  return `<style>\n${css}\n</style>\n\n${markdown}`;
}

/**
 * Runs marp-cli as a child process
 *
 * @param inputPath - Path to the input Markdown file
 * @param outputPath - Path for the output file
 * @param format - Output format
 * @param timeoutMs - Timeout in milliseconds
 * @returns ConversionResult
 */
function runMarpCLI(
  inputPath: string,
  outputPath: string,
  format: ExportFormat,
  timeoutMs: number
): Promise<ConversionResult> {
  return new Promise((resolve) => {
    // Build marp-cli arguments based on format
    const args = buildMarpArgs(inputPath, outputPath, format);

    console.log(`[marpConverter] Running marp-cli with args: ${args.join(' ')}`);

    const child = spawn('npx', ['@marp-team/marp-cli', ...args], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        // Disable telemetry
        MARP_TELEMETRY: '0',
      },
    });

    let stdout = '';
    let stderr = '';

    // Collect stdout
    child.stdout.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      // Prevent unbounded buffer growth
      if (stdout.length > MAX_BUFFER_SIZE) {
        stdout = stdout.slice(-MAX_BUFFER_SIZE);
      }
    });

    // Collect stderr
    child.stderr.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      // Prevent unbounded buffer growth
      if (stderr.length > MAX_BUFFER_SIZE) {
        stderr = stderr.slice(-MAX_BUFFER_SIZE);
      }
    });

    // Set timeout
    const timeout = setTimeout(() => {
      console.warn(`[marpConverter] Conversion timed out after ${timeoutMs}ms`);
      child.kill('SIGKILL');
      resolve({
        success: false,
        error: `Conversion timed out after ${timeoutMs / 1000} seconds`,
      });
    }, timeoutMs);

    // Handle completion
    child.on('close', (code: number) => {
      clearTimeout(timeout);

      if (code === 0) {
        resolve({
          success: true,
          outputPath,
        });
      } else {
        // Parse error from stderr
        const errorMessage = parseMarpError(stderr, stdout, code);
        resolve({
          success: false,
          error: errorMessage,
        });
      }
    });

    // Handle process errors
    child.on('error', (err: Error) => {
      clearTimeout(timeout);
      console.error(`[marpConverter] Process error: ${err.message}`);
      resolve({
        success: false,
        error: `Failed to run marp-cli: ${err.message}`,
      });
    });
  });
}

/**
 * Builds marp-cli arguments based on output format
 *
 * @param inputPath - Path to input file
 * @param outputPath - Path to output file
 * @param format - Output format
 * @returns Array of command-line arguments
 */
function buildMarpArgs(inputPath: string, outputPath: string, format: ExportFormat): string[] {
  const args: string[] = [inputPath, '-o', outputPath];

  if (format === 'pdf') {
    args.push('--pdf', '--allow-local-files');
  } else if (format === 'slides') {
    // For Google Slides, we generate PPTX first
    args.push('--pptx');
  }

  // Allow local files for embedded images
  args.push('--allow-local-files');

  return args;
}

/**
 * Parses marp-cli error output to extract meaningful error message
 *
 * @param stderr - Standard error output
 * @param stdout - Standard output
 * @param exitCode - Process exit code
 * @returns Formatted error message
 */
function parseMarpError(stderr: string, stdout: string, exitCode: number): string {
  // Try to extract error from stderr
  if (stderr) {
    // Remove common prefixes and clean up the message
    const lines = stderr.split('\n').filter((line) => line.trim());
    const errorLines = lines.filter(
      (line) =>
        line.toLowerCase().includes('error') ||
        line.toLowerCase().includes('failed') ||
        line.toLowerCase().includes('invalid')
    );

    if (errorLines.length > 0) {
      return errorLines.join('; ').trim();
    }

    // If no obvious error lines, return first non-empty line
    const firstLine = lines.find((line) => line.trim());
    if (firstLine) {
      return firstLine.trim();
    }
  }

  // Check stdout for errors
  if (stdout) {
    const lines = stdout.split('\n').filter((line) => line.trim());
    const errorLines = lines.filter((line) => line.toLowerCase().includes('error'));

    if (errorLines.length > 0) {
      return errorLines.join('; ').trim();
    }
  }

  // Generic error message
  return `marp-cli exited with code ${exitCode}`;
}
