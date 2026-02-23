import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  renderMarkdown,
  countSlides,
  generateIframeContent,
  extractComments,
  splitMarkdownSlides,
  extractFrontmatter,
  validateThemeCSS,
  resetMarpInstance,
} from './renderer';

describe('renderer', () => {
  beforeEach(() => {
    // Reset the cached Marp instance before each test
    resetMarpInstance();
  });

  afterEach(() => {
    resetMarpInstance();
  });

  describe('renderMarkdown', () => {
    it('should render markdown to HTML and CSS', () => {
      const markdown = '# Hello World';
      const result = renderMarkdown(markdown);

      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('css');
      expect(result).toHaveProperty('slideCount');
      expect(result).toHaveProperty('comments');

      expect(typeof result.html).toBe('string');
      expect(typeof result.css).toBe('string');
      expect(result.html.length).toBeGreaterThan(0);
      expect(result.css.length).toBeGreaterThan(0);
    });

    it('should return slideCount of at least 1', () => {
      const markdown = '# Single Slide';
      const result = renderMarkdown(markdown);

      expect(result.slideCount).toBeGreaterThanOrEqual(1);
    });

    it('should render multiple slides correctly', () => {
      const markdown = `---
marp: true
---

# First Slide

---

# Second Slide

---

# Third Slide
`;
      const result = renderMarkdown(markdown);

      expect(result.slideCount).toBe(3);
    });

    it('should extract comments from markdown', () => {
      const markdown = `# Slide

<!-- This is a presenter note -->

Content`;
      const result = renderMarkdown(markdown);

      expect(result.comments).toContain('This is a presenter note');
    });

    it('should handle empty markdown', () => {
      const result = renderMarkdown('');

      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('css');
      expect(result.slideCount).toBeGreaterThanOrEqual(1);
    });

    it('should accept renderer options', () => {
      const markdown = '# Test';
      const options = {
        inlineSVG: true,
        html: false,
        lazy: false,
      };

      const result = renderMarkdown(markdown, options);

      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('css');
    });
  });

  describe('countSlides', () => {
    it('should return 1 for empty markdown', () => {
      expect(countSlides('')).toBe(1);
    });

    it('should return 1 for whitespace-only markdown', () => {
      expect(countSlides('   \n\n   ')).toBe(1);
    });

    it('should return 1 for single slide without separators', () => {
      const markdown = `# Title

Some content here`;
      expect(countSlides(markdown)).toBe(1);
    });

    it('should count slides with --- separators', () => {
      const markdown = `# Slide 1

---

# Slide 2

---

# Slide 3`;
      expect(countSlides(markdown)).toBe(3);
    });

    it('should handle frontmatter correctly', () => {
      const markdown = `---
marp: true
theme: default
---

# First Slide

---

# Second Slide`;
      expect(countSlides(markdown)).toBe(2);
    });

    it('should ignore --- inside code blocks', () => {
      const markdown = `# Slide 1

\`\`\`
---
This is code, not a separator
---
\`\`\`

---

# Slide 2`;
      expect(countSlides(markdown)).toBe(2);
    });

    it('should handle multiple consecutive separators', () => {
      const markdown = `# Slide 1

---

---

# Slide 3`;
      expect(countSlides(markdown)).toBe(3);
    });
  });

  describe('generateIframeContent', () => {
    it('should generate valid HTML document', () => {
      const html = '<div class="marp">Content</div>';
      const css = '.marp { color: black; }';

      const result = generateIframeContent(html, css);

      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<html');
      expect(result).toContain('<head>');
      expect(result).toContain('</head>');
      expect(result).toContain('<body>');
      expect(result).toContain('</body>');
      expect(result).toContain('</html>');
    });

    it('should include the provided HTML content', () => {
      const html = '<div class="marp">Test Content</div>';
      const css = '';

      const result = generateIframeContent(html, css);

      expect(result).toContain('Test Content');
    });

    it('should include the provided CSS styles', () => {
      const html = '<div></div>';
      const css = '.test { color: red; }';

      const result = generateIframeContent(html, css);

      expect(result).toContain('.test { color: red; }');
    });

    it('should include Japanese lang attribute', () => {
      const result = generateIframeContent('', '');

      expect(result).toContain('lang="ja"');
    });

    it('should include viewport meta tag', () => {
      const result = generateIframeContent('', '');

      expect(result).toContain('viewport');
      expect(result).toContain('width=device-width');
    });

    it('should include UTF-8 charset', () => {
      const result = generateIframeContent('', '');

      expect(result).toContain('charset="UTF-8"');
    });

    it('should include base reset styles', () => {
      const result = generateIframeContent('', '');

      expect(result).toContain('margin: 0');
      expect(result).toContain('padding: 0');
      expect(result).toContain('box-sizing: border-box');
    });

    it('should trim the output', () => {
      const html = '<div>Content</div>';
      const css = '';

      const result = generateIframeContent(html, css);

      expect(result.startsWith('<!DOCTYPE html>')).toBe(true);
      expect(result.endsWith('</html>')).toBe(true);
    });
  });

  describe('extractComments', () => {
    it('should extract single comment', () => {
      const markdown = `# Title

<!-- This is a note -->

Content`;

      const comments = extractComments(markdown);

      expect(comments).toHaveLength(1);
      expect(comments[0]).toBe('This is a note');
    });

    it('should extract multiple comments', () => {
      const markdown = `# Slide 1

<!-- Note 1 -->

---

# Slide 2

<!-- Note 2 -->`;

      const comments = extractComments(markdown);

      expect(comments).toHaveLength(2);
      expect(comments).toContain('Note 1');
      expect(comments).toContain('Note 2');
    });

    it('should return empty array for no comments', () => {
      const markdown = `# Title

No comments here`;

      const comments = extractComments(markdown);

      expect(comments).toHaveLength(0);
    });

    it('should handle multiline comments', () => {
      const markdown = `# Title

<!--
This is a
multiline note
-->`;

      const comments = extractComments(markdown);

      expect(comments).toHaveLength(1);
      expect(comments[0]).toContain('This is a');
      expect(comments[0]).toContain('multiline note');
    });

    it('should trim comment content', () => {
      const markdown = `# Title

<!--   spaced note   -->`;

      const comments = extractComments(markdown);

      expect(comments[0]).toBe('spaced note');
    });
  });

  describe('splitMarkdownSlides', () => {
    it('should return single slide for markdown without separators', () => {
      const markdown = `# Title

Content`;

      const slides = splitMarkdownSlides(markdown);

      expect(slides).toHaveLength(1);
    });

    it('should split markdown by --- separators', () => {
      const markdown = `# Slide 1

---

# Slide 2

---

# Slide 3`;

      const slides = splitMarkdownSlides(markdown);

      expect(slides).toHaveLength(3);
    });

    it('should preserve frontmatter in first slide', () => {
      const markdown = `---
marp: true
---

# First Slide

---

# Second Slide`;

      const slides = splitMarkdownSlides(markdown);

      expect(slides[0]).toContain('marp: true');
    });

    it('should not split --- inside code blocks', () => {
      const markdown = `# Slide 1

\`\`\`markdown
---
fake separator
---
\`\`\`

---

# Slide 2`;

      const slides = splitMarkdownSlides(markdown);

      expect(slides).toHaveLength(2);
    });

    it('should return [""] for empty markdown', () => {
      const slides = splitMarkdownSlides('');

      expect(slides).toHaveLength(1);
      expect(slides[0]).toBe('');
    });
  });

  describe('extractFrontmatter', () => {
    it('should extract frontmatter from markdown', () => {
      const markdown = `---
marp: true
theme: default
---

# Content`;

      const frontmatter = extractFrontmatter(markdown);

      expect(frontmatter).toContain('marp: true');
      expect(frontmatter).toContain('theme: default');
    });

    it('should return null for markdown without frontmatter', () => {
      const markdown = `# Title

Content`;

      const frontmatter = extractFrontmatter(markdown);

      expect(frontmatter).toBeNull();
    });

    it('should return null if frontmatter is not closed', () => {
      const markdown = `---
marp: true

# Content`;

      const frontmatter = extractFrontmatter(markdown);

      expect(frontmatter).toBeNull();
    });

    it('should handle empty frontmatter', () => {
      const markdown = `---
---

# Content`;

      const frontmatter = extractFrontmatter(markdown);

      expect(frontmatter).toBe('---\n---');
    });
  });

  describe('validateThemeCSS', () => {
    it('should return true for valid CSS', () => {
      const css = `
        .slide {
          color: red;
          background: blue;
        }
      `;

      expect(validateThemeCSS(css)).toBe(true);
    });

    it('should throw error for url() in CSS', () => {
      const css = `
        .slide {
          background-image: url('https://evil.com/image.png');
        }
      `;

      expect(() => validateThemeCSS(css)).toThrow('forbidden pattern');
    });

    it('should throw error for @import in CSS', () => {
      const css = `
        @import url('https://evil.com/styles.css');
      `;

      expect(() => validateThemeCSS(css)).toThrow('forbidden pattern');
    });

    it('should throw error for expression() in CSS', () => {
      const css = `
        .slide {
          width: expression(alert('xss'));
        }
      `;

      expect(() => validateThemeCSS(css)).toThrow('forbidden pattern');
    });

    it('should throw error for javascript: in CSS', () => {
      const css = `
        .slide {
          background: javascript:alert('xss');
        }
      `;

      expect(() => validateThemeCSS(css)).toThrow('forbidden pattern');
    });

    it('should throw error for -moz-binding in CSS', () => {
      const css = `
        .slide {
          -moz-binding: url('https://evil.com/xbl.xml#xss');
        }
      `;

      expect(() => validateThemeCSS(css)).toThrow('forbidden pattern');
    });

    it('should be case insensitive for forbidden patterns', () => {
      const css = `
        .slide {
          BACKGROUND-IMAGE: URL('https://evil.com/image.png');
        }
      `;

      expect(() => validateThemeCSS(css)).toThrow('forbidden pattern');
    });
  });
});
