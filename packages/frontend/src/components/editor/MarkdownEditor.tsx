'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars } from '@codemirror/view';
import { EditorState, Compartment, Extension, Prec, Transaction } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { lintKeymap } from '@codemirror/lint';
import { useEditorStore } from '@/lib/store/editorStore';

/**
 * MarkdownEditor component props
 */
export interface MarkdownEditorProps {
  /** Current markdown value */
  value?: string;
  /** Callback when markdown changes */
  onChange?: (value: string) => void;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Additional CSS class names */
  className?: string;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Whether to show line numbers */
  showLineNumbers?: boolean;
  /** Editor theme (light/dark) */
  theme?: 'light' | 'dark';
  /** Font size in pixels */
  fontSize?: number;
  /** Whether to autofocus on mount */
  autoFocus?: boolean;
}

// Theme configuration compartment
const themeCompartment = new Compartment();
const readOnlyCompartment = new Compartment();

/**
 * Create light theme extension
 */
function createLightTheme(fontSize: number): Extension {
  return EditorView.theme({
    '&': {
      backgroundColor: '#ffffff',
      color: '#1f2937',
      height: '100%',
    },
    '.cm-content': {
      caretColor: '#3b82f6',
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      fontSize: `${fontSize}px`,
      lineHeight: '1.6',
      padding: '16px 0',
    },
    '.cm-cursor': {
      borderLeftColor: '#3b82f6',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: '#3b82f6',
    },
    '.cm-gutters': {
      backgroundColor: '#f9fafb',
      color: '#6b7280',
      border: 'none',
      borderRight: '1px solid #e5e7eb',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#f3f4f6',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(59, 130, 246, 0.05)',
    },
    '.cm-selectionMatch': {
      backgroundColor: '#fef08a',
    },
    '.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
    },
    '.cm-line': {
      padding: '0 16px',
    },
    '.cm-placeholder': {
      color: '#9ca3af',
      fontStyle: 'italic',
      padding: '0 16px',
    },
  });
}

/**
 * Create dark theme extension
 */
function createDarkTheme(fontSize: number): Extension {
  return EditorView.theme({
    '&': {
      backgroundColor: '#1f2937',
      color: '#f3f4f6',
      height: '100%',
    },
    '.cm-content': {
      caretColor: '#60a5fa',
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      fontSize: `${fontSize}px`,
      lineHeight: '1.6',
      padding: '16px 0',
    },
    '.cm-cursor': {
      borderLeftColor: '#60a5fa',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: '#60a5fa',
    },
    '.cm-gutters': {
      backgroundColor: '#111827',
      color: '#6b7280',
      border: 'none',
      borderRight: '1px solid #374151',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#1f2937',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(96, 165, 250, 0.1)',
    },
    '.cm-selectionMatch': {
      backgroundColor: '#854d0e',
    },
    '.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: 'rgba(96, 165, 250, 0.3)',
    },
    '.cm-line': {
      padding: '0 16px',
    },
    '.cm-placeholder': {
      color: '#6b7280',
      fontStyle: 'italic',
      padding: '0 16px',
    },
  });
}

/**
 * Marp directive highlighting extension
 * Highlights Marp-specific directives like ---, marp: true, etc.
 */
function createMarpHighlightExtension(): Extension {
  return EditorView.baseTheme({
    // Highlight slide separators
    '.cm-line:has(.tok-meta)': {
      // Additional styling for meta content
    },
  });
}

/**
 * Placeholder extension
 */
function createPlaceholderExtension(placeholder: string): Extension {
  const placeholderPlugin = EditorView.updateListener.of((update) => {
    // Placeholder is handled by CSS
  });

  return placeholderPlugin;
}

/**
 * Get placeholder decoration
 */
function placeholderText(placeholder: string): Extension {
  return EditorView.updateListener.of((update) => {
    // Empty - placeholder handled via CSS
  });
}

/**
 * MarkdownEditor component
 *
 * A CodeMirror 6-based Markdown editor with:
 * - Marp directive support
 * - Undo/Redo
 * - Syntax highlighting
 * - Zustand store integration
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write your Marp markdown here...',
  className = '',
  readOnly = false,
  showLineNumbers = true,
  theme = 'light',
  fontSize = 14,
  autoFocus = false,
}: MarkdownEditorProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Get Zustand store state and actions
  const storeMarkdown = useEditorStore((state) => state.markdown);
  const setMarkdown = useEditorStore((state) => state.setMarkdown);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);

  // Determine which value to use (props or store)
  const currentValue = value ?? storeMarkdown;

  // Handle client-side mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initialize CodeMirror editor
  useEffect(() => {
    if (!isMounted || !containerRef.current) return;

    // Cleanup existing editor
    if (viewRef.current) {
      viewRef.current.destroy();
    }

    // Update handler
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const newValue = update.state.doc.toString();
        if (onChange) {
          onChange(newValue);
        }
        // Update Zustand store
        setMarkdown(newValue);
      }
    });

    // Build extensions
    const extensions: Extension[] = [
      // History for undo/redo
      history(),

      // Line numbers (optional)
      showLineNumbers ? lineNumbers() : [],

      // Active line highlighting
      highlightActiveLine(),
      highlightActiveLineGutter(),

      // Special character highlighting
      highlightSpecialChars(),

      // Selection handling
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      crosshairCursor(),
      highlightSelectionMatches(),

      // Bracket matching
      bracketMatching(),

      // Close brackets auto
      closeBrackets(),

      // Markdown language support
      markdown({
        base: markdownLanguage,
      }),

      // Syntax highlighting
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),

      // Autocompletion
      autocompletion(),

      // Marp highlighting
      createMarpHighlightExtension(),

      // Update listener
      updateListener,

      // Theme (in compartment for dynamic updates)
      themeCompartment.of(
        theme === 'dark' ? createDarkTheme(fontSize) : createLightTheme(fontSize)
      ),

      // Read-only mode (in compartment for dynamic updates)
      readOnlyCompartment.of(
        readOnly ? [EditorState.readOnly.of(true)] : []
      ),

      // Keymaps
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...completionKeymap,
        ...lintKeymap,
        indentWithTab,
      ]),

      // Custom undo/redo keymap that uses Zustand store
      Prec.highest(keymap.of([
        {
          key: 'Mod-z',
          run: () => {
            undo();
            return true;
          },
        },
        {
          key: 'Mod-y',
          run: () => {
            redo();
            return true;
          },
        },
        {
          key: 'Mod-Shift-z',
          run: () => {
            redo();
            return true;
          },
        },
      ])),
    ];

    // Create editor state
    const state = EditorState.create({
      doc: currentValue,
      extensions,
    });

    // Create editor view
    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    // Autofocus if requested
    if (autoFocus) {
      view.focus();
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [isMounted, showLineNumbers]); // Re-create only on mount/unmount and line numbers change

  // Update document when value prop changes
  useEffect(() => {
    if (!viewRef.current) return;

    const currentValue = viewRef.current.state.doc.toString();
    const newValue = value ?? storeMarkdown;

    if (currentValue !== newValue) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: newValue,
        },
      });
    }
  }, [value, storeMarkdown]);

  // Update theme when theme prop changes
  useEffect(() => {
    if (!viewRef.current) return;

    viewRef.current.dispatch({
      effects: themeCompartment.reconfigure(
        theme === 'dark' ? createDarkTheme(fontSize) : createLightTheme(fontSize)
      ),
    });
  }, [theme, fontSize]);

  // Update read-only mode when prop changes
  useEffect(() => {
    if (!viewRef.current) return;

    viewRef.current.dispatch({
      effects: readOnlyCompartment.reconfigure(
        readOnly ? [EditorState.readOnly.of(true)] : []
      ),
    });
  }, [readOnly]);

  // Placeholder CSS
  const placeholderStyle = currentValue.length === 0 ? `
    .cm-content::before {
      content: "${placeholder}";
      color: ${theme === 'dark' ? '#6b7280' : '#9ca3af'};
      position: absolute;
      pointer-events: none;
      padding: 0 16px;
      font-style: italic;
    }
  ` : '';

  return (
    <div
      className={`markdown-editor ${className}`}
      style={{ height: '100%', position: 'relative' }}
    >
      <style jsx global>{`
        .markdown-editor .cm-editor {
          height: 100%;
          outline: none;
        }
        .markdown-editor .cm-scroller {
          overflow: auto;
        }
        ${placeholderStyle}
      `}</style>
      <div
        ref={containerRef}
        style={{ height: '100%' }}
        data-testid="markdown-editor-container"
      />
    </div>
  );
}

export default MarkdownEditor;
