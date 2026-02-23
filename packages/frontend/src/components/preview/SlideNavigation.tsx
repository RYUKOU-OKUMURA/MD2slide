'use client';

import { useEffect, useCallback, useRef } from 'react';

/**
 * SlideNavigation component props
 */
export interface SlideNavigationProps {
  /** Current slide index (0-based) */
  currentSlide: number;
  /** Total number of slides */
  totalSlides: number;
  /** Callback when previous button is clicked */
  onPrev: () => void;
  /** Callback when next button is clicked */
  onNext: () => void;
  /** Additional CSS class names */
  className?: string;
  /** Whether to enable keyboard navigation (default: true) */
  enableKeyboard?: boolean;
  /** Whether to show slide counter (default: true) */
  showCounter?: boolean;
  /** Whether to disable the navigation buttons */
  disabled?: boolean;
}

/**
 * SlideNavigation component
 *
 * Provides navigation controls for slides:
 * - Previous/Next buttons
 * - Current slide counter
 * - Keyboard navigation (arrow keys)
 */
export function SlideNavigation({
  currentSlide,
  totalSlides,
  onPrev,
  onNext,
  className = '',
  enableKeyboard = true,
  showCounter = true,
  disabled = false,
}: SlideNavigationProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  // Navigation state
  const isFirstSlide = currentSlide <= 0;
  const isLastSlide = currentSlide >= totalSlides - 1;

  // Handle keyboard navigation
  useEffect(() => {
    if (!enableKeyboard || disabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle if typing in an input
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          event.preventDefault();
          if (!isFirstSlide) {
            onPrev();
          }
          break;

        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ': // Spacebar
          event.preventDefault();
          if (!isLastSlide) {
            onNext();
          }
          break;

        case 'Home':
          event.preventDefault();
          if (!isFirstSlide) {
            // Jump to first slide by calling onPrev multiple times
            // Better approach would be to have a goToFirst prop
            for (let i = currentSlide; i > 0; i--) {
              onPrev();
            }
          }
          break;

        case 'End':
          event.preventDefault();
          if (!isLastSlide) {
            // Jump to last slide
            for (let i = currentSlide; i < totalSlides - 1; i++) {
              onNext();
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enableKeyboard, disabled, isFirstSlide, isLastSlide, onPrev, onNext, currentSlide, totalSlides]);

  // Button click handlers with keyboard accessibility
  const handlePrevClick = useCallback(() => {
    if (!disabled && !isFirstSlide) {
      onPrev();
    }
  }, [disabled, isFirstSlide, onPrev]);

  const handleNextClick = useCallback(() => {
    if (!disabled && !isLastSlide) {
      onNext();
    }
  }, [disabled, isLastSlide, onNext]);

  // Render icon components
  const PrevIcon = () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 15L7 10L12 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const NextIcon = () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M8 5L13 10L8 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  // Button base styles
  const buttonBaseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    padding: '0',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    backgroundColor: '#ffffff',
    color: '#374151',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.15s ease',
    outline: 'none',
  };

  const buttonDisabledStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    opacity: 0.4,
    cursor: 'not-allowed',
    backgroundColor: '#f3f4f6',
  };

  return (
    <div
      ref={containerRef}
      className={`slide-navigation ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
      role="navigation"
      aria-label="Slide navigation"
      data-testid="slide-navigation"
    >
      {/* Previous button */}
      <button
        type="button"
        onClick={handlePrevClick}
        disabled={disabled || isFirstSlide}
        style={disabled || isFirstSlide ? buttonDisabledStyle : buttonBaseStyle}
        aria-label="Previous slide"
        title="Previous slide (Arrow Left)"
        data-testid="slide-nav-prev"
      >
        <PrevIcon />
      </button>

      {/* Slide counter */}
      {showCounter && (
        <div
          className="slide-counter"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontFamily: 'ui-monospace, monospace',
            fontSize: '14px',
            color: '#374151',
            minWidth: '80px',
            justifyContent: 'center',
          }}
          aria-live="polite"
          aria-atomic="true"
          data-testid="slide-counter"
        >
          <span
            className="slide-counter-current"
            style={{ fontWeight: '600' }}
            data-testid="slide-counter-current"
          >
            {currentSlide + 1}
          </span>
          <span style={{ color: '#9ca3af' }}>/</span>
          <span
            className="slide-counter-total"
            style={{ color: '#6b7280' }}
            data-testid="slide-counter-total"
          >
            {totalSlides}
          </span>
        </div>
      )}

      {/* Next button */}
      <button
        type="button"
        onClick={handleNextClick}
        disabled={disabled || isLastSlide}
        style={disabled || isLastSlide ? buttonDisabledStyle : buttonBaseStyle}
        aria-label="Next slide"
        title="Next slide (Arrow Right)"
        data-testid="slide-nav-next"
      >
        <NextIcon />
      </button>
    </div>
  );
}

export default SlideNavigation;
