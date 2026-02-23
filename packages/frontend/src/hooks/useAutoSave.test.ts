import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAutoSave } from './useAutoSave';
import * as localStorageModule from '@/lib/storage/localStorage';

// Mock the localStorage module
vi.mock('@/lib/storage/localStorage', () => ({
  saveMarkdown: vi.fn(),
  loadMarkdown: vi.fn(),
}));

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with initialContent when provided', () => {
      vi.mocked(localStorageModule.loadMarkdown).mockReturnValue(null);

      const { result } = renderHook(() =>
        useAutoSave({ initialContent: '# Initial Content' })
      );

      expect(result.current.content).toBe('# Initial Content');
      expect(result.current.saveStatus).toBe('idle');
    });

    it('should restore content from LocalStorage on initialization', async () => {
      const savedContent = '# Saved Content';
      vi.mocked(localStorageModule.loadMarkdown).mockReturnValue(savedContent);

      const { result } = renderHook(() => useAutoSave());

      // Wait for the initialization effect to run
      await act(async () => {
        vi.runAllTimers();
      });

      expect(result.current.content).toBe(savedContent);
      expect(result.current.isInitialized).toBe(true);
    });

    it('should use initialContent when LocalStorage is empty', async () => {
      vi.mocked(localStorageModule.loadMarkdown).mockReturnValue(null);

      const { result } = renderHook(() =>
        useAutoSave({ initialContent: '# Initial' })
      );

      await act(async () => {
        vi.runAllTimers();
      });

      expect(result.current.content).toBe('# Initial');
    });

    it('should prioritize LocalStorage content over initialContent', async () => {
      const savedContent = '# Saved Content';
      vi.mocked(localStorageModule.loadMarkdown).mockReturnValue(savedContent);

      const { result } = renderHook(() =>
        useAutoSave({ initialContent: '# Initial' })
      );

      await act(async () => {
        vi.runAllTimers();
      });

      expect(result.current.content).toBe(savedContent);
    });

    it('should set isInitialized to true after initialization', async () => {
      vi.mocked(localStorageModule.loadMarkdown).mockReturnValue(null);

      const { result } = renderHook(() => useAutoSave());

      expect(result.current.isInitialized).toBe(false);

      await act(async () => {
        vi.runAllTimers();
      });

      expect(result.current.isInitialized).toBe(true);
    });
  });

  describe('setContent with debounce', () => {
    it('should update content when setContent is called', () => {
      vi.mocked(localStorageModule.loadMarkdown).mockReturnValue(null);

      const { result } = renderHook(() => useAutoSave());

      act(() => {
        result.current.setContent('# New Content');
      });

      expect(result.current.content).toBe('# New Content');
    });

    it('should not save immediately when setContent is called', () => {
      vi.mocked(localStorageModule.loadMarkdown).mockReturnValue(null);

      const { result } = renderHook(() => useAutoSave());

      act(() => {
        result.current.setContent('# New Content');
      });

      // Should not have saved yet (debounced)
      expect(localStorageModule.saveMarkdown).not.toHaveBeenCalled();
      expect(result.current.saveStatus).toBe('idle');
    });

    it('should save after debounce delay', async () => {
      vi.mocked(localStorageModule.loadMarkdown).mockReturnValue(null);

      const { result } = renderHook(() =>
        useAutoSave({ debounceMs: 1000 })
      );

      act(() => {
        result.current.setContent('# New Content');
      });

      // Advance timers by the debounce delay
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(localStorageModule.saveMarkdown).toHaveBeenCalledWith('# New Content');
    });

    it('should use default debounce of 3000ms', async () => {
      vi.mocked(localStorageModule.loadMarkdown).mockReturnValue(null);

      const { result } = renderHook(() => useAutoSave());

      act(() => {
        result.current.setContent('# New Content');
      });

      // Should not save before 3000ms
      await act(async () => {
        vi.advanceTimersByTime(2999);
      });

      expect(localStorageModule.saveMarkdown).not.toHaveBeenCalled();

      // Should save at 3000ms
      await act(async () => {
        vi.advanceTimersByTime(1);
      });

      expect(localStorageModule.saveMarkdown).toHaveBeenCalledWith('# New Content');
    });

    it('should reset debounce timer on subsequent setContent calls', async () => {
      vi.mocked(localStorageModule.loadMarkdown).mockReturnValue(null);

      const { result } = renderHook(() =>
        useAutoSave({ debounceMs: 1000 })
      );

      act(() => {
        result.current.setContent('# First');
      });

      // Advance time but not enough to trigger save
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Call setContent again - should reset debounce
      act(() => {
        result.current.setContent('# Second');
      });

      // Advance to where first save would have happened
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Still should not have saved
      expect(localStorageModule.saveMarkdown).not.toHaveBeenCalled();

      // Now advance to trigger the second save
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(localStorageModule.saveMarkdown).toHaveBeenCalledWith('# Second');
      expect(localStorageModule.saveMarkdown).toHaveBeenCalledTimes(1);
    });

    it('should update saveStatus to saving then saved', async () => {
      vi.mocked(localStorageModule.loadMarkdown).mockReturnValue(null);

      const { result } = renderHook(() =>
        useAutoSave({ debounceMs: 100 })
      );

      act(() => {
        result.current.setContent('# New Content');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.saveStatus).toBe('saved');
    });
  });

  describe('Manual save', () => {
    it('should save immediately when save() is called', async () => {
      vi.mocked(localStorageModule.loadMarkdown).mockReturnValue(null);

      const { result } = renderHook(() => useAutoSave());

      act(() => {
        result.current.setContent('# Content');
      });

      // Manually save before debounce triggers
      act(() => {
        result.current.save();
      });

      expect(localStorageModule.saveMarkdown).toHaveBeenCalledWith('# Content');
    });

    it('should cancel pending debounce save when save() is called', async () => {
      vi.mocked(localStorageModule.loadMarkdown).mockReturnValue(null);

      const { result } = renderHook(() =>
        useAutoSave({ debounceMs: 5000 })
      );

      act(() => {
        result.current.setContent('# Content');
      });

      // Manually save before debounce would trigger
      act(() => {
        result.current.save();
      });

      expect(localStorageModule.saveMarkdown).toHaveBeenCalledTimes(1);

      // Advance time past debounce - should not save again
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(localStorageModule.saveMarkdown).toHaveBeenCalledTimes(1);
    });
  });

  describe('Save status', () => {
    it('should set status to saved on successful save', async () => {
      vi.mocked(localStorageModule.loadMarkdown).mockReturnValue(null);

      const { result } = renderHook(() =>
        useAutoSave({ debounceMs: 100 })
      );

      act(() => {
        result.current.setContent('# Content');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.saveStatus).toBe('saved');
    });

    it('should set status to error when save fails', async () => {
      vi.mocked(localStorageModule.loadMarkdown).mockReturnValue(null);
      vi.mocked(localStorageModule.saveMarkdown).mockImplementation(() => {
        throw new Error('Storage error');
      });

      const { result } = renderHook(() =>
        useAutoSave({ debounceMs: 100 })
      );

      act(() => {
        result.current.setContent('# Content');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.saveStatus).toBe('error');
      expect(result.current.errorMessage).toBe('Storage error');
    });

    it('should skip save if content has not changed', async () => {
      const savedContent = '# Saved';
      vi.mocked(localStorageModule.loadMarkdown).mockReturnValue(savedContent);

      const { result } = renderHook(() =>
        useAutoSave({ debounceMs: 100 })
      );

      await act(async () => {
        vi.runAllTimers();
      });

      // Clear the mock after initialization
      vi.mocked(localStorageModule.saveMarkdown).mockClear();

      // Try to save the same content
      act(() => {
        result.current.setContent(savedContent);
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(localStorageModule.saveMarkdown).not.toHaveBeenCalled();
      expect(result.current.saveStatus).toBe('saved');
    });
  });

  describe('Callbacks', () => {
    it('should call onSave callback on successful save', async () => {
      const onSave = vi.fn();
      vi.mocked(localStorageModule.loadMarkdown).mockReturnValue(null);

      const { result } = renderHook(() =>
        useAutoSave({ debounceMs: 100, onSave })
      );

      act(() => {
        result.current.setContent('# Content');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('should call onError callback on save failure', async () => {
      const onError = vi.fn();
      vi.mocked(localStorageModule.loadMarkdown).mockReturnValue(null);
      vi.mocked(localStorageModule.saveMarkdown).mockImplementation(() => {
        throw new Error('Save failed');
      });

      const { result } = renderHook(() =>
        useAutoSave({ debounceMs: 100, onError })
      );

      act(() => {
        result.current.setContent('# Content');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Save failed',
      }));
    });
  });

  describe('Cleanup', () => {
    it('should clear debounce timer on unmount', () => {
      vi.mocked(localStorageModule.loadMarkdown).mockReturnValue(null);

      const { result, unmount } = renderHook(() =>
        useAutoSave({ debounceMs: 5000 })
      );

      act(() => {
        result.current.setContent('# Content');
      });

      unmount();

      // Advance timers past debounce - should not save after unmount
      vi.advanceTimersByTime(5000);

      expect(localStorageModule.saveMarkdown).not.toHaveBeenCalled();
    });
  });
});
