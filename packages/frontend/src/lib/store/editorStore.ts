import { create } from 'zustand';

/**
 * History entry for undo/redo functionality
 */
interface HistoryEntry {
  markdown: string;
  timestamp: number;
}

/**
 * Editor state interface
 */
export interface EditorState {
  /** Current markdown content */
  markdown: string;
  /** Current slide index (0-based) */
  currentSlide: number;
  /** Total number of slides */
  totalSlides: number;
  /** Set markdown content */
  setMarkdown: (md: string) => void;
  /** Set current slide index */
  setCurrentSlide: (n: number) => void;
  /** Set total slides count */
  setTotalSlides: (n: number) => void;
  /** Undo last change */
  undo: () => void;
  /** Redo last undone change */
  redo: () => void;
  /** Check if undo is available */
  canUndo: () => boolean;
  /** Check if redo is available */
  canRedo: () => boolean;
  /** Clear all history */
  clearHistory: () => void;
}

/** LocalStorage key for markdown content */
const STORAGE_KEY = 'md2slide:markdown';

/** Maximum history size */
const MAX_HISTORY_SIZE = 50;

/** Debounce delay for history updates (ms) */
const HISTORY_DEBOUNCE_DELAY = 300;

/**
 * Load initial markdown from localStorage
 */
function loadFromStorage(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ?? '';
  } catch {
    return '';
  }
}

/**
 * Save markdown to localStorage
 */
function saveToStorage(markdown: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, markdown);
  } catch {
    // Ignore storage errors (quota exceeded, private mode, etc.)
  }
}

/**
 * Count the number of slides based on Marp slide separators
 */
function countSlides(markdown: string): number {
  if (!markdown.trim()) {
    return 1;
  }

  // Match Marp slide separators: --- (with optional whitespace)
  // Also handle frontmatter by ignoring the first --- if followed by marp directive
  const lines = markdown.split('\n');
  let slideCount = 1;
  let inFrontmatter = false;
  let frontmatterEnded = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check for frontmatter start
    if (i === 0 && line === '---') {
      inFrontmatter = true;
      continue;
    }

    // Check for frontmatter end
    if (inFrontmatter && line === '---') {
      inFrontmatter = false;
      frontmatterEnded = true;
      continue;
    }

    // Count slide separators (not in frontmatter)
    if (!inFrontmatter && line === '---') {
      // After frontmatter, the first --- after it starts the first real slide content
      // Subsequent --- are slide separators
      if (frontmatterEnded) {
        slideCount++;
      }
    }
  }

  // Simple approach: count --- occurrences outside code blocks
  const simpleCount = (markdown.match(/^---$/gm) || []).length;

  // If there's a frontmatter (starts with ---), subtract 2 (start and end of frontmatter)
  // and the first slide separator after frontmatter starts slide 1
  if (markdown.trimStart().startsWith('---')) {
    // Frontmatter present
    const separators = simpleCount;
    // First two --- are frontmatter, remaining are slide separators
    // Number of slides = remaining separators + 1
    return Math.max(1, separators - 1);
  }

  // No frontmatter: slides = separators + 1
  return Math.max(1, simpleCount + 1);
}

/**
 * Create history store for undo/redo
 */
interface HistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];
  pushHistory: (markdown: string) => void;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
}

const createHistoryStore = (): HistoryState => {
  let past: HistoryEntry[] = [];
  let future: HistoryEntry[] = [];
  let lastPushTime = 0;

  return {
    past: [],
    future: [],

    pushHistory: (markdown: string) => {
      const now = Date.now();

      // Debounce: don't push if called too quickly
      if (now - lastPushTime < HISTORY_DEBOUNCE_DELAY) {
        return;
      }
      lastPushTime = now;

      // Don't push if content is the same
      if (past.length > 0 && past[past.length - 1].markdown === markdown) {
        return;
      }

      // Add to past, clear future
      past.push({ markdown, timestamp: now });
      future = [];

      // Limit history size
      if (past.length > MAX_HISTORY_SIZE) {
        past = past.slice(-MAX_HISTORY_SIZE);
      }
    },

    undo: () => {
      if (past.length === 0) return null;

      const current = past.pop()!;
      return current;
    },

    redo: () => {
      if (future.length === 0) return null;

      const next = future.pop()!;
      past.push(next);
      return next;
    },

    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,

    clear: () => {
      past = [];
      future = [];
    },
  };
};

// Singleton history store
const historyStore = createHistoryStore();

/**
 * Editor store using Zustand
 */
export const useEditorStore = create<EditorState>((set, get) => ({
  markdown: '',
  currentSlide: 0,
  totalSlides: 1,

  setMarkdown: (md: string) => {
    const state = get();

    // Push current state to history before changing (if different)
    if (state.markdown !== md && state.markdown !== '') {
      historyStore.pushHistory(state.markdown);
    }

    // Update state
    set({
      markdown: md,
      totalSlides: countSlides(md),
    });

    // Save to localStorage (debounced externally if needed)
    saveToStorage(md);
  },

  setCurrentSlide: (n: number) => {
    const state = get();
    if (n >= 0 && n < state.totalSlides) {
      set({ currentSlide: n });
    }
  },

  setTotalSlides: (n: number) => {
    if (n >= 1) {
      set({ totalSlides: n });
    }
  },

  undo: () => {
    const state = get();

    // Save current state to future for redo
    if (state.markdown !== '') {
      historyStore.future.push({ markdown: state.markdown, timestamp: Date.now() });
    }

    const entry = historyStore.undo();
    if (entry) {
      set({
        markdown: entry.markdown,
        totalSlides: countSlides(entry.markdown),
      });
      saveToStorage(entry.markdown);
    } else {
      // Nothing to undo, restore future
      historyStore.future.pop();
    }
  },

  redo: () => {
    const state = get();

    // Save current state to past
    if (state.markdown !== '') {
      historyStore.past.push({ markdown: state.markdown, timestamp: Date.now() });
    }

    const entry = historyStore.redo();
    if (entry) {
      set({
        markdown: entry.markdown,
        totalSlides: countSlides(entry.markdown),
      });
      saveToStorage(entry.markdown);
    } else {
      // Nothing to redo, restore past
      historyStore.past.pop();
    }
  },

  canUndo: () => historyStore.canUndo(),

  canRedo: () => historyStore.canRedo(),

  clearHistory: () => {
    historyStore.clear();
  },
}));

/**
 * Initialize store from localStorage (call on client-side mount)
 */
export function initializeEditorFromStorage(): void {
  const stored = loadFromStorage();
  if (stored) {
    useEditorStore.setState({
      markdown: stored,
      totalSlides: countSlides(stored),
    });
  }
}

/**
 * Get slide count from markdown (utility function)
 */
export function getSlideCount(markdown: string): number {
  return countSlides(markdown);
}
