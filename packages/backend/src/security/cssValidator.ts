/**
 * CSS Whitelist Validator
 *
 * Validates custom CSS to prevent security vulnerabilities:
 * - External resource loading (url())
 * - JavaScript execution (expression(), javascript:)
 * - External stylesheet loading (@import)
 * - IE-specific behaviors (behavior:, -moz-binding:)
 */

export interface CSSValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Patterns that are explicitly blocked in CSS
 */
const BLOCKED_PATTERNS = [
  {
    pattern: /url\s*\(/gi,
    message: 'url() is not allowed - prevents external resource loading',
  },
  {
    pattern: /expression\s*\(/gi,
    message: 'expression() is not allowed - prevents IE JavaScript execution',
  },
  {
    pattern: /@import/gi,
    message: '@import is not allowed - prevents loading external stylesheets',
  },
  {
    pattern: /behavior\s*:/gi,
    message: 'behavior: is not allowed - prevents IE behaviors',
  },
  {
    pattern: /-moz-binding\s*:/gi,
    message: '-moz-binding: is not allowed - prevents XBL binding',
  },
  {
    pattern: /javascript\s*:/gi,
    message: 'javascript: is not allowed - prevents JavaScript execution',
  },
  {
    pattern: /vbscript\s*:/gi,
    message: 'vbscript: is not allowed - prevents VBScript execution',
  },
  {
    pattern: /-o-link\s*:/gi,
    message: '-o-link: is not allowed - prevents Opera link execution',
  },
  {
    pattern: /-o-link-source\s*:/gi,
    message: '-o-link-source: is not allowed - prevents Opera link source execution',
  },
];

/**
 * Obfuscation patterns that might indicate an attack attempt
 */
const OBFUSCATION_PATTERNS = [
  {
    // Encoded characters that might be used to bypass filters
    pattern: /\\[0-9a-fA-F]{1,6}\s?/g,
    message: 'CSS escape sequences are not allowed',
  },
  {
    // Null bytes
    pattern: /\x00/g,
    message: 'Null bytes are not allowed in CSS',
  },
  {
    // HTML comments in CSS
    pattern: /<!--|-->/g,
    message: 'HTML comments are not allowed in CSS',
  },
];

/**
 * Maximum allowed CSS length (in characters)
 */
const MAX_CSS_LENGTH = 100000;

/**
 * Validates CSS content against security rules
 *
 * @param css - The CSS string to validate
 * @returns CSSValidationResult with valid status and any errors found
 */
export function validateCSS(css: string): CSSValidationResult {
  const errors: string[] = [];

  // Check for null/undefined input
  if (css === null || css === undefined) {
    return {
      valid: false,
      errors: ['CSS input is required'],
    };
  }

  // Ensure css is a string
  if (typeof css !== 'string') {
    return {
      valid: false,
      errors: ['CSS input must be a string'],
    };
  }

  // Check for excessive length
  if (css.length > MAX_CSS_LENGTH) {
    errors.push(`CSS exceeds maximum length of ${MAX_CSS_LENGTH} characters`);
    return {
      valid: false,
      errors,
    };
  }

  // Check for blocked patterns
  for (const { pattern, message } of BLOCKED_PATTERNS) {
    const matches = css.match(pattern);
    if (matches) {
      errors.push(message);
    }
  }

  // Check for obfuscation attempts
  for (const { pattern, message } of OBFUSCATION_PATTERNS) {
    const matches = css.match(pattern);
    if (matches) {
      errors.push(message);
    }
  }

  // Check for @charset that might be used for encoding attacks
  const charsetMatch = css.match(/@charset\s+["']([^"']+)["']/i);
  if (charsetMatch && charsetMatch[1].toLowerCase() !== 'utf-8') {
    errors.push('Only UTF-8 charset is allowed');
  }

  // Check for @namespace that might be used for XML attacks
  if (/@namespace/gi.test(css)) {
    errors.push('@namespace is not allowed');
  }

  // Check for embedded data URIs that might contain malicious content
  if (/data\s*:\s*[^;]*;base64/gi.test(css)) {
    errors.push('Base64 data URIs are not allowed');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitizes CSS by removing or escaping dangerous content
 * Note: For strict security, prefer validation and rejection over sanitization
 *
 * @param css - The CSS string to sanitize
 * @returns Sanitized CSS string (use only if validation fails and fallback is needed)
 */
export function sanitizeCSS(css: string): string {
  if (!css || typeof css !== 'string') {
    return '';
  }

  let sanitized = css;

  // Remove blocked patterns
  for (const { pattern } of BLOCKED_PATTERNS) {
    sanitized = sanitized.replace(pattern, '/* blocked */');
  }

  // Remove obfuscation patterns
  for (const { pattern } of OBFUSCATION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  return sanitized;
}
