import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Options for useDebounce hook
 */
export interface UseDebounceOptions {
  /** Debounce delay in milliseconds (default: 300) */
  delay?: number;
  /** Whether to run on leading edge (default: false) */
  leading?: boolean;
  /** Whether to run on trailing edge (default: true) */
  trailing?: boolean;
  /** Maximum time to wait before forcing execution (default: undefined) */
  maxWait?: number;
}

const DEFAULT_DELAY = 300;

/**
 * Custom hook for debouncing a value
 *
 * @param value - The value to debounce
 * @param delay - Debounce delay in milliseconds (default: 300)
 * @returns The debounced value
 *
 * @example
 * ```tsx
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearchTerm = useDebounce(searchTerm, 300);
 *
 * useEffect(() => {
 *   // This effect only runs 300ms after the last change
 *   searchAPI(debouncedSearchTerm);
 * }, [debouncedSearchTerm]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number = DEFAULT_DELAY): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up the timeout
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timeout if value changes or component unmounts
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Custom hook for debouncing a callback function
 *
 * @param callback - The callback function to debounce
 * @param delay - Debounce delay in milliseconds (default: 300)
 * @returns The debounced callback function
 *
 * @example
 * ```tsx
 * const debouncedSave = useDebouncedCallback((content) => {
 *   saveToServer(content);
 * }, 300);
 *
 * // In event handler
 * handleChange((e) => {
 *   setContent(e.target.value);
 *   debouncedSave(e.target.value);
 * });
 * ```
 */
export function useDebouncedCallback<T extends (...args: Parameters<T>) => ReturnType<T>>(
  callback: T,
  delay: number = DEFAULT_DELAY
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );

  return debouncedCallback;
}

/**
 * Custom hook with advanced debounce options
 *
 * @param value - The value to debounce
 * @param options - Debounce options
 * @returns Object containing debounced value and control methods
 *
 * @example
 * ```tsx
 * const { value: debouncedValue, cancel, flush } = useDebounceAdvanced(inputValue, {
 *   delay: 300,
 *   leading: true,
 *   maxWait: 1000,
 * });
 * ```
 */
export function useDebounceAdvanced<T>(
  value: T,
  options: UseDebounceOptions = {}
): {
  /** Debounced value */
  value: T;
  /** Cancel pending update */
  cancel: () => void;
  /** Immediately apply pending update */
  flush: () => void;
  /** Whether there's a pending update */
  isPending: boolean;
} {
  const { delay = DEFAULT_DELAY, leading = false, trailing = true, maxWait } = options;

  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const [isPending, setIsPending] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leadingExecutedRef = useRef(false);
  const lastValueRef = useRef(value);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (maxWaitTimeoutRef.current) {
      clearTimeout(maxWaitTimeoutRef.current);
      maxWaitTimeoutRef.current = null;
    }
    setIsPending(false);
    leadingExecutedRef.current = false;
  }, []);

  // Flush function
  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (maxWaitTimeoutRef.current) {
      clearTimeout(maxWaitTimeoutRef.current);
      maxWaitTimeoutRef.current = null;
    }
    setDebouncedValue(lastValueRef.current);
    setIsPending(false);
    leadingExecutedRef.current = false;
  }, []);

  // Cancel function
  const cancel = useCallback(() => {
    cleanup();
    // Reset to the current actual value
    lastValueRef.current = value;
    setDebouncedValue(value);
  }, [cleanup, value]);

  useEffect(() => {
    lastValueRef.current = value;

    // Execute on leading edge
    if (leading && !leadingExecutedRef.current) {
      leadingExecutedRef.current = true;
      setDebouncedValue(value);
    }

    setIsPending(true);

    // Set up trailing edge timeout
    if (trailing) {
      timeoutRef.current = setTimeout(() => {
        setDebouncedValue(value);
        setIsPending(false);
        leadingExecutedRef.current = false;
        timeoutRef.current = null;
      }, delay);
    }

    // Set up maxWait timeout if specified
    if (maxWait !== undefined && !maxWaitTimeoutRef.current) {
      maxWaitTimeoutRef.current = setTimeout(() => {
        setDebouncedValue(lastValueRef.current);
        setIsPending(false);
        leadingExecutedRef.current = false;
        maxWaitTimeoutRef.current = null;

        // Also clear the trailing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }, maxWait);
    }

    return cleanup;
  }, [value, delay, leading, trailing, maxWait, cleanup]);

  return {
    value: debouncedValue,
    cancel,
    flush,
    isPending,
  };
}

export default useDebounce;
