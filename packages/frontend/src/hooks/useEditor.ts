import { useCallback, useEffect, useState } from 'react';
import {
  useEditorStore,
  initializeEditorFromStorage,
  getSlideCount,
} from '@/lib/store/editorStore';

/**
 * Keyboard shortcut configuration
 */
interface ShortcutConfig {
  undo: string[];
  redo: string[];
}

const DEFAULT_SHORTCUTS: ShortcutConfig = {
  undo: ['ctrl+z', 'meta+z'],
  redo: ['ctrl+y', 'meta+y', 'ctrl+shift+z', 'meta+shift+z'],
};

/**
 * Check if a keyboard event matches a shortcut
 */
function matchesShortcut(
  event: KeyboardEvent,
  shortcuts: string[]
): boolean {
  const key = event.key.toLowerCase();
  const ctrl = event.ctrlKey || event.metaKey;
  const shift = event.shiftKey;

  for (const shortcut of shortcuts) {
    const parts = shortcut.toLowerCase().split('+');
    const hasCtrl = parts.includes('ctrl') || parts.includes('meta');
    const hasShift = parts.includes('shift');
    const shortcutKey = parts[parts.length - 1];

    if (
      key === shortcutKey &&
      ctrl === hasCtrl &&
      shift === hasShift
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Editor hook return type
 */
export interface UseEditorReturn {
  /** Current markdown content */
  markdown: string;
  /** Current slide index (0-based) */
  currentSlide: number;
  /** Total number of slides */
  totalSlides: number;
  /** Update markdown content */
  setMarkdown: (md: string) => void;
  /** Navigate to a specific slide */
  setCurrentSlide: (n: number) => void;
  /** Undo last change */
  undo: () => void;
  /** Redo last undone change */
  redo: () => void;
  /** Check if undo is available */
  canUndo: boolean;
  /** Check if redo is available */
  canRedo: boolean;
  /** Whether the store has been initialized from localStorage */
  isInitialized: boolean;
  /** Insert text at current cursor position (for use with CodeMirror) */
  insertText: (text: string) => ((view: unknown) => boolean) | null;
  /** Count slides in a markdown string */
  countSlides: (md: string) => number;
}

/**
 * Custom hook for editor logic
 *
 * Provides:
 * - Undo/redo keyboard shortcuts
 * - LocalStorage initialization
 * - Slide navigation
 */
export function useEditor(): UseEditorReturn {
  const [isInitialized, setIsInitialized] = useState(false);

  const markdown = useEditorStore((state) => state.markdown);
  const currentSlide = useEditorStore((state) => state.currentSlide);
  const totalSlides = useEditorStore((state) => state.totalSlides);
  const setMarkdown = useEditorStore((state) => state.setMarkdown);
  const setCurrentSlide = useEditorStore((state) => state.setCurrentSlide);
  const setTotalSlides = useEditorStore((state) => state.setTotalSlides);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const canUndoFn = useEditorStore((state) => state.canUndo);
  const canRedoFn = useEditorStore((state) => state.canRedo);

  // Track canUndo/canRedo state for reactivity
  const [canUndoState, setCanUndoState] = useState(false);
  const [canRedoState, setCanRedoState] = useState(false);

  // Update undo/redo state when markdown changes
  useEffect(() => {
    setCanUndoState(canUndoFn());
    setCanRedoState(canRedoFn());
  }, [markdown, canUndoFn, canRedoFn]);

  // Initialize from localStorage on mount
  useEffect(() => {
    if (!isInitialized) {
      initializeEditorFromStorage();
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle shortcuts if no undo/redo available
      if (matchesShortcut(event, DEFAULT_SHORTCUTS.undo)) {
        if (canUndoFn()) {
          event.preventDefault();
          undo();
        }
        return;
      }

      if (matchesShortcut(event, DEFAULT_SHORTCUTS.redo)) {
        if (canRedoFn()) {
          event.preventDefault();
          redo();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndoFn, canRedoFn]);

  /**
   * Create a CodeMirror command to insert text
   * Returns a function that can be used as a CodeMirror command
   */
  const insertText = useCallback(
    (text: string) => {
      // This will be implemented when integrated with CodeMirror
      // For now, return null as we need the CodeMirror view instance
      return null;
    },
    []
  );

  /**
   * Count slides in a markdown string
   */
  const countSlidesInMarkdown = useCallback((md: string) => {
    return getSlideCount(md);
  }, []);

  return {
    markdown,
    currentSlide,
    totalSlides,
    setMarkdown,
    setCurrentSlide,
    undo,
    redo,
    canUndo: canUndoState,
    canRedo: canRedoState,
    isInitialized,
    insertText,
    countSlides: countSlidesInMarkdown,
  };
}

/**
 * Hook for managing editor toolbar actions
 */
export interface UseEditorToolbarReturn {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  goToPreviousSlide: () => void;
  goToNextSlide: () => void;
  goToFirstSlide: () => void;
  goToLastSlide: () => void;
  isFirstSlide: boolean;
  isLastSlide: boolean;
  currentSlide: number;
  totalSlides: number;
}

export function useEditorToolbar(): UseEditorToolbarReturn {
  const currentSlide = useEditorStore((state) => state.currentSlide);
  const totalSlides = useEditorStore((state) => state.totalSlides);
  const setCurrentSlide = useEditorStore((state) => state.setCurrentSlide);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const canUndoFn = useEditorStore((state) => state.canUndo);
  const canRedoFn = useEditorStore((state) => state.canRedo);
  const markdown = useEditorStore((state) => state.markdown);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    setCanUndo(canUndoFn());
    setCanRedo(canRedoFn());
  }, [markdown, canUndoFn, canRedoFn]);

  const goToPreviousSlide = useCallback(() => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  }, [currentSlide, setCurrentSlide]);

  const goToNextSlide = useCallback(() => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  }, [currentSlide, totalSlides, setCurrentSlide]);

  const goToFirstSlide = useCallback(() => {
    setCurrentSlide(0);
  }, [setCurrentSlide]);

  const goToLastSlide = useCallback(() => {
    if (totalSlides > 0) {
      setCurrentSlide(totalSlides - 1);
    }
  }, [totalSlides, setCurrentSlide]);

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    goToPreviousSlide,
    goToNextSlide,
    goToFirstSlide,
    goToLastSlide,
    isFirstSlide: currentSlide === 0,
    isLastSlide: currentSlide === totalSlides - 1,
    currentSlide,
    totalSlides,
  };
}
