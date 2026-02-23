'use client';

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import {
  renderMarkdown,
  generateIframeContent,
  type MarpRendererOptions,
} from '@/lib/marp';
import { useDebounce } from '@/hooks/useDebounce';

/**
 * SlidePreview component props
 */
export interface SlidePreviewProps {
  /** Markdown content to render */
  markdown: string;
  /** Current slide index (0-based) */
  currentSlide?: number;
  /** Total number of slides (for generating proper slide navigation) */
  totalSlides?: number;
  /** Additional CSS class names */
  className?: string;
  /** Custom theme CSS */
  theme?: string;
  /** Debounce delay in milliseconds (default: 300) */
  debounceDelay?: number;
  /** Called when rendering is complete */
  onRenderComplete?: (slideCount: number) => void;
  /** Called when rendering encounters an error */
  onRenderError?: (error: Error) => void;
  /** Whether to show loading indicator */
  showLoading?: boolean;
}

// 16:9 aspect ratio constant
const ASPECT_RATIO = 16 / 9;

/**
 * SlidePreview component
 *
 * Renders Marp markdown slides in an iframe with 16:9 fixed aspect ratio.
 * Includes debounced preview updates for performance.
 */
export function SlidePreview({
  markdown,
  currentSlide = 0,
  totalSlides = 1,
  className = '',
  theme,
  debounceDelay = 300,
  onRenderComplete,
  onRenderError,
  showLoading = true,
}: SlidePreviewProps): JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [renderError, setRenderError] = useState<Error | null>(null);

  // Debounce markdown to prevent excessive re-renders
  const debouncedMarkdown = useDebounce(markdown, debounceDelay);

  // Renderer options
  const rendererOptions = useMemo<MarpRendererOptions>(() => ({
    theme,
  }), [theme]);

  // Generate iframe content
  const iframeContent = useMemo(() => {
    try {
      setRenderError(null);
      const result = renderMarkdown(debouncedMarkdown, rendererOptions);
      const html = generateIframeContent(result.html, result.css);

      // Notify parent of render completion
      if (onRenderComplete) {
        onRenderComplete(result.slideCount);
      }

      return html;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setRenderError(err);
      if (onRenderError) {
        onRenderError(err);
      }
      return generateErrorContent(err.message);
    }
  }, [debouncedMarkdown, rendererOptions, onRenderComplete, onRenderError]);

  // Update iframe content
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    setIsLoading(true);

    // Use srcdoc for iframe content
    iframe.srcdoc = iframeContent;

    // Handle iframe load event
    const handleLoad = () => {
      setIsLoading(false);
      navigateToSlide(iframe, currentSlide);
    };

    iframe.addEventListener('load', handleLoad);

    return () => {
      iframe.removeEventListener('load', handleLoad);
    };
  }, [iframeContent, currentSlide]);

  // Navigate to specific slide when currentSlide changes
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || isLoading) return;

    navigateToSlide(iframe, currentSlide);
  }, [currentSlide, isLoading]);

  return (
    <div
      ref={containerRef}
      className={`slide-preview ${className}`}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
      data-testid="slide-preview-container"
    >
      {/* Loading overlay */}
      {showLoading && isLoading && (
        <div
          className="slide-preview-loading"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            zIndex: 10,
          }}
          data-testid="slide-preview-loading"
        >
          <div className="loading-spinner">
            Loading...
          </div>
        </div>
      )}

      {/* Error overlay */}
      {renderError && (
        <div
          className="slide-preview-error"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(254, 226, 226, 0.9)',
            color: '#dc2626',
            padding: '20px',
            zIndex: 10,
          }}
          data-testid="slide-preview-error"
        >
          <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>Render Error</p>
          <p style={{ fontSize: '14px', textAlign: 'center' }}>{renderError.message}</p>
        </div>
      )}

      {/* Aspect ratio container */}
      <div
        className="slide-preview-aspect"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          className="slide-preview-wrapper"
          style={{
            width: '100%',
            maxWidth: `calc(100vh * ${ASPECT_RATIO})`,
            aspectRatio: `${ASPECT_RATIO}`,
            backgroundColor: '#fff',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            overflow: 'hidden',
          }}
        >
          <iframe
            ref={iframeRef}
            title="Slide Preview"
            sandbox="allow-same-origin"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
            }}
            data-testid="slide-preview-iframe"
          />
        </div>
      </div>

      {/* Slide indicator */}
      <div
        className="slide-preview-indicator"
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontFamily: 'monospace',
        }}
        data-testid="slide-preview-indicator"
      >
        {currentSlide + 1} / {totalSlides}
      </div>
    </div>
  );
}

/**
 * Navigate iframe to specific slide
 */
function navigateToSlide(iframe: HTMLIFrameElement, slideIndex: number): void {
  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) return;

    // Find all slides (Marp renders slides as SVG pages)
    const slides = iframeDoc.querySelectorAll('svg');

    if (slides.length === 0) return;

    // Show only the current slide
    slides.forEach((slide, index) => {
      if (index === slideIndex) {
        slide.style.display = 'block';
        slide.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        slide.style.display = 'none';
      }
    });
  } catch {
    // Cross-origin access might fail, ignore silently
  }
}

/**
 * Generate error content for iframe
 */
function generateErrorContent(message: string): string {
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      font-family: system-ui, -apple-system, sans-serif;
      background: #fef2f2;
      color: #dc2626;
    }
    .error-container {
      text-align: center;
      padding: 20px;
    }
    .error-title {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 8px;
    }
    .error-message {
      font-size: 14px;
      opacity: 0.8;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <div class="error-title">Render Error</div>
    <div class="error-message">${escapeHtml(message)}</div>
  </div>
</body>
</html>
`.trim();
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

export default SlidePreview;
