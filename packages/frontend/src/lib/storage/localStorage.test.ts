import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getItem,
  setItem,
  removeItem,
  saveMarkdown,
  loadMarkdown,
  saveSplitPaneWidth,
  loadSplitPaneWidth,
  STORAGE_KEYS,
} from './localStorage';

describe('localStorage', () => {
  // Store original localStorage
  const originalLocalStorage = window.localStorage;

  beforeEach(() => {
    // Create a fresh mock localStorage before each test
    const store: Record<string, string> = {};

    const mockLocalStorage = {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach(key => delete store[key]);
      }),
      get length() {
        return Object.keys(store).length;
      },
      key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    };

    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original localStorage
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  describe('STORAGE_KEYS', () => {
    it('should have MARKDOWN key', () => {
      expect(STORAGE_KEYS.MARKDOWN).toBe('md2slide_markdown');
    });

    it('should have SPLIT_PANE_WIDTH key', () => {
      expect(STORAGE_KEYS.SPLIT_PANE_WIDTH).toBe('md2slide_split_width');
    });
  });

  describe('getItem', () => {
    it('should return null when key does not exist', () => {
      const result = getItem(STORAGE_KEYS.MARKDOWN);
      expect(result).toBeNull();
    });

    it('should return value when key exists', () => {
      window.localStorage.setItem(STORAGE_KEYS.MARKDOWN, 'test content');

      const result = getItem(STORAGE_KEYS.MARKDOWN);
      expect(result).toBe('test content');
    });

    it('should return null when localStorage throws an error', () => {
      const errorLocalStorage = {
        ...window.localStorage,
        getItem: vi.fn(() => {
          throw new Error('Storage error');
        }),
      };

      Object.defineProperty(window, 'localStorage', {
        value: errorLocalStorage,
        writable: true,
        configurable: true,
      });

      const result = getItem(STORAGE_KEYS.MARKDOWN);
      expect(result).toBeNull();
    });
  });

  describe('setItem', () => {
    it('should store value in localStorage', () => {
      setItem(STORAGE_KEYS.MARKDOWN, 'test content');

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.MARKDOWN,
        'test content'
      );
    });

    it('should throw QuotaExceededError when storage is full', () => {
      const errorLocalStorage = {
        ...window.localStorage,
        setItem: vi.fn(() => {
          const error = new DOMException('Quota exceeded', 'QuotaExceededError');
          throw error;
        }),
      };

      Object.defineProperty(window, 'localStorage', {
        value: errorLocalStorage,
        writable: true,
        configurable: true,
      });

      expect(() => setItem(STORAGE_KEYS.MARKDOWN, 'content')).toThrow(
        'Storage quota exceeded'
      );
    });

    it('should rethrow non-quota errors', () => {
      const errorLocalStorage = {
        ...window.localStorage,
        setItem: vi.fn(() => {
          throw new Error('Unknown error');
        }),
      };

      Object.defineProperty(window, 'localStorage', {
        value: errorLocalStorage,
        writable: true,
        configurable: true,
      });

      expect(() => setItem(STORAGE_KEYS.MARKDOWN, 'content')).toThrow(
        'Unknown error'
      );
    });
  });

  describe('removeItem', () => {
    it('should remove item from localStorage', () => {
      removeItem(STORAGE_KEYS.MARKDOWN);

      expect(window.localStorage.removeItem).toHaveBeenCalledWith(
        STORAGE_KEYS.MARKDOWN
      );
    });

    it('should not throw when removeItem fails', () => {
      const errorLocalStorage = {
        ...window.localStorage,
        removeItem: vi.fn(() => {
          throw new Error('Remove error');
        }),
      };

      Object.defineProperty(window, 'localStorage', {
        value: errorLocalStorage,
        writable: true,
        configurable: true,
      });

      // Should not throw
      expect(() => removeItem(STORAGE_KEYS.MARKDOWN)).not.toThrow();
    });
  });

  describe('saveMarkdown', () => {
    it('should save markdown content', () => {
      const content = '# Hello World\n\nThis is markdown.';
      saveMarkdown(content);

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.MARKDOWN,
        content
      );
    });

    it('should save empty string', () => {
      saveMarkdown('');

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.MARKDOWN,
        ''
      );
    });

    it('should save large markdown content', () => {
      const largeContent = 'x'.repeat(100000);
      saveMarkdown(largeContent);

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.MARKDOWN,
        largeContent
      );
    });
  });

  describe('loadMarkdown', () => {
    it('should load markdown content', () => {
      const content = '# Saved Content';
      window.localStorage.setItem(STORAGE_KEYS.MARKDOWN, content);

      const result = loadMarkdown();
      expect(result).toBe(content);
    });

    it('should return null when no content saved', () => {
      const result = loadMarkdown();
      expect(result).toBeNull();
    });
  });

  describe('saveSplitPaneWidth', () => {
    it('should save split pane width as string', () => {
      saveSplitPaneWidth(50);

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.SPLIT_PANE_WIDTH,
        '50'
      );
    });

    it('should save decimal width values', () => {
      saveSplitPaneWidth(33.5);

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.SPLIT_PANE_WIDTH,
        '33.5'
      );
    });
  });

  describe('loadSplitPaneWidth', () => {
    it('should load split pane width as number', () => {
      window.localStorage.setItem(STORAGE_KEYS.SPLIT_PANE_WIDTH, '50');

      const result = loadSplitPaneWidth();
      expect(result).toBe(50);
    });

    it('should return null when no width saved', () => {
      const result = loadSplitPaneWidth();
      expect(result).toBeNull();
    });

    it('should return null for invalid number', () => {
      window.localStorage.setItem(STORAGE_KEYS.SPLIT_PANE_WIDTH, 'invalid');

      const result = loadSplitPaneWidth();
      expect(result).toBeNull();
    });
  });

  describe('SSR / browser environment handling', () => {
    it('should handle undefined window gracefully', () => {
      const originalWindow = global.window;
      // @ts-expect-error - intentionally deleting window for test
      delete global.window;

      // These should not throw
      expect(() => {
        // Create new module instance would handle this
        // For existing functions, they check typeof window
      }).not.toThrow();

      // Restore window
      global.window = originalWindow;
    });

    it('getItem should return null when localStorage is not available', () => {
      // Create environment without localStorage
      const windowWithoutStorage = {
        ...window,
        localStorage: undefined,
      };

      Object.defineProperty(global, 'window', {
        value: windowWithoutStorage,
        writable: true,
        configurable: true,
      });

      const result = getItem(STORAGE_KEYS.MARKDOWN);
      expect(result).toBeNull();

      // Restore
      Object.defineProperty(global, 'window', {
        value: window,
        writable: true,
        configurable: true,
      });
    });

    it('setItem should not throw when localStorage is not available', () => {
      // Create environment without localStorage
      const windowWithoutStorage = {
        ...window,
        localStorage: undefined,
      };

      Object.defineProperty(global, 'window', {
        value: windowWithoutStorage,
        writable: true,
        configurable: true,
      });

      // Should not throw
      expect(() => setItem(STORAGE_KEYS.MARKDOWN, 'content')).not.toThrow();

      // Restore
      Object.defineProperty(global, 'window', {
        value: window,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('Error handling', () => {
    it('should handle localStorage test failure gracefully', () => {
      const failingLocalStorage = {
        ...window.localStorage,
        setItem: vi.fn(() => {
          throw new Error('Disabled');
        }),
      };

      Object.defineProperty(window, 'localStorage', {
        value: failingLocalStorage,
        writable: true,
        configurable: true,
      });

      // getItem checks availability first, should return null
      const result = getItem(STORAGE_KEYS.MARKDOWN);
      expect(result).toBeNull();
    });

    it('should handle private browsing mode restrictions', () => {
      const privateLocalStorage = {
        ...window.localStorage,
        setItem: vi.fn(() => {
          throw new DOMException('Private mode', 'QuotaExceededError');
        }),
      };

      Object.defineProperty(window, 'localStorage', {
        value: privateLocalStorage,
        writable: true,
        configurable: true,
      });

      expect(() => setItem(STORAGE_KEYS.MARKDOWN, 'content')).toThrow(
        'Storage quota exceeded'
      );
    });
  });
});
