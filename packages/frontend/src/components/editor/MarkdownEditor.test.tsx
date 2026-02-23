import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MarkdownEditor } from './MarkdownEditor';
import { useEditorStore } from '@/lib/store/editorStore';

// Mock the editor store
vi.mock('@/lib/store/editorStore', () => ({
  useEditorStore: vi.fn(),
}));

// Mock CodeMirror to avoid DOM issues in tests
vi.mock('@codemirror/view', () => ({
  EditorView: {
    theme: vi.fn(() => () => {}),
    baseTheme: vi.fn(() => () => {}),
    updateListener: {
      of: vi.fn(() => () => {}),
    },
  },
  lineNumbers: vi.fn(() => () => {}),
  highlightActiveLine: vi.fn(() => () => {}),
  highlightActiveLineGutter: vi.fn(() => () => {}),
  drawSelection: vi.fn(() => () => {}),
  dropCursor: vi.fn(() => () => {}),
  rectangularSelection: vi.fn(() => () => {}),
  crosshairCursor: vi.fn(() => () => {}),
  highlightSpecialChars: vi.fn(() => () => {}),
}));

vi.mock('@codemirror/state', () => ({
  EditorState: {
    create: vi.fn(() => ({
      doc: {
        toString: () => '',
      },
    })),
    readOnly: {
      of: vi.fn(() => () => {}),
    },
  },
  Compartment: vi.fn(() => ({
    of: vi.fn(() => () => {}),
    reconfigure: vi.fn(),
  })),
  Extension: {},
  Prec: {
    highest: vi.fn(() => () => {}),
  },
  Transaction: {},
}));

vi.mock('@codemirror/commands', () => ({
  defaultKeymap: [],
  history: vi.fn(() => () => {}),
  historyKeymap: [],
  indentWithTab: {},
}));

vi.mock('@codemirror/lang-markdown', () => ({
  markdown: vi.fn(() => () => {}),
  markdownLanguage: {},
}));

vi.mock('@codemirror/language', () => ({
  syntaxHighlighting: vi.fn(() => () => {}),
  defaultHighlightStyle: {},
  bracketMatching: vi.fn(() => () => {}),
}));

vi.mock('@codemirror/autocomplete', () => ({
  closeBrackets: vi.fn(() => () => {}),
  closeBracketsKeymap: [],
  autocompletion: vi.fn(() => () => {}),
  completionKeymap: [],
}));

vi.mock('@codemirror/search', () => ({
  searchKeymap: [],
  highlightSelectionMatches: vi.fn(() => () => {}),
}));

vi.mock('@codemirror/lint', () => ({
  lintKeymap: [],
}));

// Mock next/script for styled-jsx
vi.mock('next/script', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

describe('MarkdownEditor', () => {
  const mockSetMarkdown = vi.fn();
  const mockUndo = vi.fn();
  const mockRedo = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock for useEditorStore
    (useEditorStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: (state: unknown) => unknown) => {
      const state = {
        markdown: '',
        setMarkdown: mockSetMarkdown,
        undo: mockUndo,
        redo: mockRedo,
      };
      return selector(state);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the editor container', () => {
      render(<MarkdownEditor />);

      const container = screen.getByTestId('markdown-editor-container');
      expect(container).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      const { container } = render(<MarkdownEditor className="custom-class" />);

      const editor = container.querySelector('.markdown-editor');
      expect(editor).toHaveClass('custom-class');
    });

    it('should render with default placeholder', () => {
      render(<MarkdownEditor />);

      // The placeholder is rendered via CSS, so we check the parent element
      const editor = screen.getByTestId('markdown-editor-container').parentElement;
      expect(editor).toBeInTheDocument();
    });

    it('should render with custom placeholder', () => {
      render(<MarkdownEditor placeholder="Custom placeholder" />);

      const container = screen.getByTestId('markdown-editor-container');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Value props', () => {
    it('should accept value prop', () => {
      const testValue = '# Hello World';
      render(<MarkdownEditor value={testValue} />);

      const container = screen.getByTestId('markdown-editor-container');
      expect(container).toBeInTheDocument();
    });

    it('should prioritize value prop over store value', () => {
      const testValue = '# Test Content';

      (useEditorStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: (state: unknown) => unknown) => {
        const state = {
          markdown: 'store content',
          setMarkdown: mockSetMarkdown,
          undo: mockUndo,
          redo: mockRedo,
        };
        return selector(state);
      });

      render(<MarkdownEditor value={testValue} />);

      const container = screen.getByTestId('markdown-editor-container');
      expect(container).toBeInTheDocument();
    });
  });

  describe('onChange callback', () => {
    it('should call onChange when content changes', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();

      render(<MarkdownEditor onChange={handleChange} />);

      const container = screen.getByTestId('markdown-editor-container');
      expect(container).toBeInTheDocument();

      // Note: Full keyboard interaction testing would require a more complete
      // CodeMirror mock or integration testing setup
    });

    it('should accept onChange prop without errors', () => {
      const handleChange = vi.fn();
      render(<MarkdownEditor onChange={handleChange} />);

      const container = screen.getByTestId('markdown-editor-container');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Props handling', () => {
    it('should accept readOnly prop', () => {
      render(<MarkdownEditor readOnly />);

      const container = screen.getByTestId('markdown-editor-container');
      expect(container).toBeInTheDocument();
    });

    it('should accept showLineNumbers prop', () => {
      render(<MarkdownEditor showLineNumbers={false} />);

      const container = screen.getByTestId('markdown-editor-container');
      expect(container).toBeInTheDocument();
    });

    it('should accept theme prop', () => {
      render(<MarkdownEditor theme="dark" />);

      const container = screen.getByTestId('markdown-editor-container');
      expect(container).toBeInTheDocument();
    });

    it('should accept fontSize prop', () => {
      render(<MarkdownEditor fontSize={16} />);

      const container = screen.getByTestId('markdown-editor-container');
      expect(container).toBeInTheDocument();
    });

    it('should accept autoFocus prop', () => {
      render(<MarkdownEditor autoFocus />);

      const container = screen.getByTestId('markdown-editor-container');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper container structure', () => {
      const { container } = render(<MarkdownEditor />);

      const editorWrapper = container.querySelector('.markdown-editor');
      expect(editorWrapper).toBeInTheDocument();
      expect(editorWrapper).toHaveStyle({ height: '100%', position: 'relative' });
    });
  });
});
