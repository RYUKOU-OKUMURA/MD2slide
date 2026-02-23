import { Marp } from '@marp-team/marp-core';

/**
 * Result of rendering markdown to HTML/CSS
 */
export interface MarpRenderResult {
  /** Rendered HTML content */
  html: string;
  /** CSS styles for the rendered content */
  css: string;
  /** Total number of slides */
  slideCount: number;
  /** Comments extracted from slides (presenter notes) */
  comments: string[];
}

/**
 * Options for Marp renderer
 */
export interface MarpRendererOptions {
  /** Custom theme CSS (will be validated) */
  theme?: string;
  /** Whether to enable inline SVG rendering */
  inlineSVG?: boolean;
  /** Whether to enable HTML in markdown */
  html?: boolean;
  /** Slide number to render (0-indexed). If not specified, renders all slides */
  slideIndex?: number;
}

/**
 * Default renderer options
 */
const DEFAULT_OPTIONS: Required<Omit<MarpRendererOptions, 'theme' | 'slideIndex'>> = {
  inlineSVG: true,
  html: false,
};

/**
 * Create a configured Marp instance
 */
function createMarpInstance(options: MarpRendererOptions = {}): Marp {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  const marp = new Marp({
    inlineSVG: mergedOptions.inlineSVG,
    html: mergedOptions.html,
  });

  // Register custom theme if provided
  if (mergedOptions.theme) {
    // Theme validation should be done externally before passing to renderer
    try {
      marp.themeSet.default = marp.themeSet.add(mergedOptions.theme);
    } catch {
      // If theme registration fails, continue with default theme
      console.warn('Failed to register custom theme, using default');
    }
  }

  return marp;
}

/**
 * Singleton Marp instance for performance
 */
let marpInstance: Marp | null = null;
let lastOptions: string | null = null;

/**
 * Get or create Marp instance (cached for performance)
 */
function getMarpInstance(options: MarpRendererOptions = {}): Marp {
  const optionsKey = JSON.stringify(options);

  if (marpInstance && lastOptions === optionsKey) {
    return marpInstance;
  }

  marpInstance = createMarpInstance(options);
  lastOptions = optionsKey;
  return marpInstance;
}

/**
 * Reset Marp instance (useful when theme changes)
 */
export function resetMarpInstance(): void {
  marpInstance = null;
  lastOptions = null;
}

/**
 * Render markdown to HTML and CSS using Marp
 *
 * @param markdown - Markdown content to render
 * @param options - Renderer options
 * @returns Rendered result with HTML, CSS, slide count, and comments
 */
export function renderMarkdown(
  markdown: string,
  options: MarpRendererOptions = {}
): MarpRenderResult {
  const marp = getMarpInstance(options);

  const { html, css } = marp.render(markdown);

  // Extract comments from each slide (presenter notes)
  const comments = extractComments(markdown);

  // Count slides
  const slideCount = countSlides(markdown);

  return {
    html,
    css,
    slideCount,
    comments,
  };
}

/**
 * Render a specific slide from markdown
 *
 * @param markdown - Full markdown content
 * @param slideIndex - 0-based slide index
 * @param options - Renderer options
 * @returns Rendered result for the specific slide
 */
export function renderSlide(
  markdown: string,
  slideIndex: number,
  options: MarpRendererOptions = {}
): MarpRenderResult | null {
  const slides = splitMarkdownSlides(markdown);

  if (slideIndex < 0 || slideIndex >= slides.length) {
    return null;
  }

  const targetSlide = slides[slideIndex];

  // Preserve frontmatter for the first slide
  const frontmatter = extractFrontmatter(markdown);
  const markdownToRender = slideIndex === 0 && frontmatter
    ? markdown
    : targetSlide;

  return renderMarkdown(markdownToRender, options);
}

/**
 * Count the number of slides in markdown
 *
 * @param markdown - Markdown content
 * @returns Number of slides (minimum 1)
 */
export function countSlides(markdown: string): number {
  if (!markdown || !markdown.trim()) {
    return 1;
  }

  // Use Marp's internal slide counting
  const marp = getMarpInstance();

  // Create a minimal render to count slides
  const lines = markdown.split('\n');
  let slideCount = 1;
  let inFrontmatter = false;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle code blocks (triple backticks)
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    // Skip if inside code block
    if (inCodeBlock) {
      continue;
    }

    // Handle frontmatter
    if (i === 0 && line.trim() === '---') {
      inFrontmatter = true;
      continue;
    }

    if (inFrontmatter && line.trim() === '---') {
      inFrontmatter = false;
      continue;
    }

    // Count slide separators (not in frontmatter)
    if (!inFrontmatter && line.trim() === '---') {
      slideCount++;
    }
  }

  return Math.max(1, slideCount);
}

/**
 * Split markdown into individual slides
 *
 * @param markdown - Full markdown content
 * @returns Array of slide markdown strings
 */
export function splitMarkdownSlides(markdown: string): string[] {
  if (!markdown || !markdown.trim()) {
    return [''];
  }

  const lines = markdown.split('\n');
  const slides: string[] = [];
  let currentSlide: string[] = [];
  let inFrontmatter = false;
  let inCodeBlock = false;
  let frontmatter: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle code blocks
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      currentSlide.push(line);
      continue;
    }

    // Skip slide separators inside code blocks
    if (inCodeBlock) {
      currentSlide.push(line);
      continue;
    }

    // Handle frontmatter
    if (i === 0 && line.trim() === '---') {
      inFrontmatter = true;
      frontmatter.push(line);
      continue;
    }

    if (inFrontmatter && line.trim() === '---') {
      inFrontmatter = false;
      frontmatter.push(line);
      continue;
    }

    // If still in frontmatter, collect frontmatter lines
    if (inFrontmatter) {
      frontmatter.push(line);
      continue;
    }

    // Handle slide separator
    if (line.trim() === '---') {
      // Save current slide (if not empty)
      if (currentSlide.length > 0 && currentSlide.some(l => l.trim())) {
        slides.push(currentSlide.join('\n'));
      }
      currentSlide = [];
      continue;
    }

    // Regular content
    currentSlide.push(line);
  }

  // Add the last slide
  if (currentSlide.length > 0 && currentSlide.some(l => l.trim())) {
    slides.push(currentSlide.join('\n'));
  }

  // Prepend frontmatter to first slide
  if (frontmatter.length > 0 && slides.length > 0) {
    slides[0] = frontmatter.join('\n') + '\n' + slides[0];
  }

  return slides.length > 0 ? slides : [''];
}

/**
 * Extract frontmatter from markdown
 *
 * @param markdown - Markdown content
 * @returns Frontmatter string or null if not present
 */
export function extractFrontmatter(markdown: string): string | null {
  if (!markdown.trimStart().startsWith('---')) {
    return null;
  }

  const lines = markdown.split('\n');
  const frontmatter: string[] = ['---'];
  let frontmatterEnded = false;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === '---') {
      frontmatter.push(line);
      frontmatterEnded = true;
      break;
    }

    frontmatter.push(line);
  }

  if (frontmatterEnded) {
    return frontmatter.join('\n');
  }

  return null;
}

/**
 * Extract comments (presenter notes) from markdown
 * Marp uses HTML comments for presenter notes: <!-- comment -->
 *
 * @param markdown - Markdown content
 * @returns Array of comment strings
 */
export function extractComments(markdown: string): string[] {
  const comments: string[] = [];
  const commentRegex = /<!--\s*([\s\S]*?)\s*-->/g;
  let match;

  while ((match = commentRegex.exec(markdown)) !== null) {
    comments.push(match[1].trim());
  }

  return comments;
}

/**
 * Generate complete HTML document for iframe rendering
 *
 * @param html - Rendered HTML content
 * @param css - Rendered CSS styles
 * @returns Complete HTML document string
 */
export function generateIframeContent(html: string, css: string): string {
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    ${css}

    /* Reset and base styles for iframe */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #fff;
    }

    /* Marp container */
    div.marp {
      width: 100%;
      height: 100%;
    }

    /* Scale slides to fit container while maintaining aspect ratio */
    svg {
      width: 100% !important;
      height: 100% !important;
      max-width: 100%;
      max-height: 100%;
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>
`.trim();
}

/**
 * Validate custom theme CSS
 * Checks for potentially dangerous CSS constructs
 *
 * @param css - Custom theme CSS
 * @returns true if valid, throws error if invalid
 */
export function validateThemeCSS(css: string): boolean {
  // List of forbidden patterns
  const forbiddenPatterns = [
    /url\s*\(/i,           // url() - could load external resources
    /@import/i,            // @import - could load external resources
    /expression\s*\(/i,    // expression() - IE JavaScript execution
    /javascript:/i,        // javascript: URLs
    /binding\s*:/i,        // XBL binding (Firefox)
    /-moz-binding/i,       // Firefox XBL
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(css)) {
      throw new Error(`Invalid theme CSS: forbidden pattern found (${pattern.source})`);
    }
  }

  return true;
}
