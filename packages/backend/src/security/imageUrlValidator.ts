/**
 * Image URL Validator - SSRF Prevention
 *
 * Validates image URLs to prevent Server-Side Request Forgery (SSRF) attacks:
 * - Only HTTPS protocol allowed
 * - Blocks private IP ranges (RFC1918)
 * - Blocks localhost and loopback addresses
 * - Blocks link-local addresses
 * - Blocks cloud metadata endpoints
 * - Blocks DNS rebinding domains
 * - Follows and validates redirects
 * - DNS resolution with IP validation
 */

import { createRequire } from 'module';
import * as dns from 'dns';
import * as https from 'https';
import { URL } from 'url';
import { promisify } from 'util';

const require = createRequire(import.meta.url);
const net = require('net');

const dnsLookup = promisify(dns.lookup);

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Maximum number of redirects to follow
 */
const MAX_REDIRECTS = 3;

/**
 * Request timeout in milliseconds
 */
const REQUEST_TIMEOUT = 5000;

/**
 * Maximum URL length
 */
const MAX_URL_LENGTH = 2048;

/**
 * Blocked IP ranges (private, loopback, link-local, etc.)
 */
const BLOCKED_IP_RANGES = [
  // Loopback: 127.0.0.0/8
  { start: '127.0.0.0', end: '127.255.255.255' },
  // Private: 10.0.0.0/8
  { start: '10.0.0.0', end: '10.255.255.255' },
  // Private: 172.16.0.0/12
  { start: '172.16.0.0', end: '172.31.255.255' },
  // Private: 192.168.0.0/16
  { start: '192.168.0.0', end: '192.168.255.255' },
  // Link-local: 169.254.0.0/16
  { start: '169.254.0.0', end: '169.254.255.255' },
  // Cloud metadata: 169.254.169.254 (single IP)
  { start: '169.254.169.254', end: '169.254.169.254' },
  // 0.0.0.0/8 - "This" network
  { start: '0.0.0.0', end: '0.255.255.255' },
  // 100.64.0.0/10 - Carrier-grade NAT
  { start: '100.64.0.0', end: '100.127.255.255' },
  // 192.0.0.0/24 - IANA IPv4 Special Purpose Address Registry
  { start: '192.0.0.0', end: '192.0.0.255' },
  // 192.0.2.0/24 - TEST-NET-1
  { start: '192.0.2.0', end: '192.0.2.255' },
  // 198.51.100.0/24 - TEST-NET-2
  { start: '198.51.100.0', end: '198.51.100.255' },
  // 203.0.113.0/24 - TEST-NET-3
  { start: '203.0.113.0', end: '203.0.113.255' },
  // 198.18.0.0/15 - Network benchmark tests
  { start: '198.18.0.0', end: '198.19.255.255' },
  // 224.0.0.0/4 - Multicast
  { start: '224.0.0.0', end: '239.255.255.255' },
  // 240.0.0.0/4 - Reserved
  { start: '240.0.0.0', end: '255.255.255.255' },
];

/**
 * Blocked hostname patterns (DNS rebinding, internal domains)
 */
const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /\.localdomain$/i,
  /\.localhost$/i,
  /^local$/i,
  /^host$/i,
  /\.home$/i,
  /\.lan$/i,
  /\.intranet$/i,
  /\.corp$/i,
  /\.private$/i,
  /^ip6-localhost$/i,
  /^ip6-loopback$/i,
  /\.ip6\.allhosts$/i,
  /\.ip6\.allnodes$/i,
  /\.ip6\.allrouters$/i,
  /\.ip6\.local$/i,
  // Kubernetes internal
  /\.kubernetes\.default$/i,
  /\.kubernetes\.default\.svc$/i,
  /\.svc\.cluster\.local$/i,
  // Docker internal
  /\.docker\.internal$/i,
  // Cloud provider internal
  /\.metadata$/i,
  /\.metadata\.google$/i,
  /\.metadata\.google\.internal$/i,
];

/**
 * Convert IP address to numeric value for comparison
 */
function ipToNumber(ip: string): number {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some(isNaN)) {
    return -1;
  }
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/**
 * Check if an IP address is in a blocked range
 */
function isBlockedIP(ip: string): boolean {
  const ipNum = ipToNumber(ip);
  if (ipNum < 0) {
    return true; // Invalid IP, block it
  }

  for (const range of BLOCKED_IP_RANGES) {
    const startNum = ipToNumber(range.start);
    const endNum = ipToNumber(range.end);
    if (ipNum >= startNum && ipNum <= endNum) {
      return true;
    }
  }

  return false;
}

/**
 * Check if hostname matches blocked patterns
 */
function isBlockedHostname(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase();

  for (const pattern of BLOCKED_HOSTNAME_PATTERNS) {
    if (pattern.test(normalizedHostname)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if string is a valid IP address format
 */
function isIPAddress(str: string): boolean {
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Pattern.test(str)) {
    const parts = str.split('.').map((p) => parseInt(p, 10));
    return parts.every((p) => p >= 0 && p <= 255);
  }

  // IPv6 pattern (simplified)
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  if (ipv6Pattern.test(str)) {
    return true;
  }

  // IPv6 with :: shorthand
  const ipv6ShorthandPattern = /^::$|^::[0-9a-fA-F:]+$|^[0-9a-fA-F:]+::$|^[0-9a-fA-F:]+::[0-9a-fA-F:]+$/;
  if (ipv6ShorthandPattern.test(str)) {
    return true;
  }

  return false;
}

/**
 * Check if IPv6 address is blocked
 */
function isBlockedIPv6(ip: string): boolean {
  const normalizedIP = ip.toLowerCase();

  // Loopback ::1
  if (normalizedIP === '::1' || normalizedIP === '0:0:0:0:0:0:0:1') {
    return true;
  }

  // Unspecified address ::
  if (normalizedIP === '::' || normalizedIP === '0:0:0:0:0:0:0:0') {
    return true;
  }

  // Link-local fe80::/10
  if (normalizedIP.startsWith('fe80:') || normalizedIP.startsWith('fe8') || normalizedIP.startsWith('fe9') || normalizedIP.startsWith('fea') || normalizedIP.startsWith('feb')) {
    return true;
  }

  // Unique local fc00::/7
  if (normalizedIP.startsWith('fc') || normalizedIP.startsWith('fd')) {
    return true;
  }

  // Multicast ff00::/8
  if (normalizedIP.startsWith('ff')) {
    return true;
  }

  // IPv4-mapped IPv6 addresses (::ffff:0:0/96)
  if (normalizedIP.includes(':ffff:')) {
    // Extract the IPv4 part and check it
    const ipv4Match = normalizedIP.match(/:ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (ipv4Match && isBlockedIP(ipv4Match[1])) {
      return true;
    }
  }

  return false;
}

/**
 * Resolve hostname to IP address using DNS
 */
async function resolveHostname(hostname: string): Promise<string[]> {
  try {
    // Use dns.lookup with all addresses
    const result = await dnsLookup(hostname, { all: true });
    return result.map((r) => r.address);
  } catch {
    throw new Error(`Failed to resolve hostname: ${hostname}`);
  }
}

/**
 * Validate a single URL without following redirects
 */
async function validateSingleUrl(urlString: string): Promise<{ valid: boolean; error?: string }> {
  let parsedUrl: URL;

  // Check URL length
  if (urlString.length > MAX_URL_LENGTH) {
    return { valid: false, error: 'URL exceeds maximum length' };
  }

  // Parse URL
  try {
    parsedUrl = new URL(urlString);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Check protocol - only HTTPS allowed
  if (parsedUrl.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTPS protocol is allowed for image URLs' };
  }

  const hostname = parsedUrl.hostname;

  // Check for blocked hostname patterns
  if (isBlockedHostname(hostname)) {
    return { valid: false, error: 'Hostname is not allowed' };
  }

  // Check if hostname is an IP address directly
  if (isIPAddress(hostname)) {
    if (hostname.includes(':')) {
      // IPv6
      if (isBlockedIPv6(hostname)) {
        return { valid: false, error: 'IP address is not allowed' };
      }
    } else {
      // IPv4
      if (isBlockedIP(hostname)) {
        return { valid: false, error: 'IP address is not allowed' };
      }
    }
    return { valid: true };
  }

  // Resolve hostname to IP addresses
  let ips: string[];
  try {
    ips = await resolveHostname(hostname);
  } catch (e) {
    return { valid: false, error: 'Failed to resolve hostname' };
  }

  // Check all resolved IP addresses
  for (const ip of ips) {
    if (ip.includes(':')) {
      // IPv6
      if (isBlockedIPv6(ip)) {
        return { valid: false, error: 'Resolved IP address is not allowed' };
      }
    } else {
      // IPv4
      if (isBlockedIP(ip)) {
        return { valid: false, error: 'Resolved IP address is not allowed' };
      }
    }
  }

  return { valid: true };
}

/**
 * Follow redirects and validate each URL in the chain
 */
async function followAndValidateRedirects(
  urlString: string,
  redirectCount: number = 0,
  visitedUrls: Set<string> = new Set()
): Promise<ImageValidationResult> {
  // Check redirect limit
  if (redirectCount > MAX_REDIRECTS) {
    return { valid: false, error: 'Too many redirects' };
  }

  // Check for redirect loops
  if (visitedUrls.has(urlString)) {
    return { valid: false, error: 'Redirect loop detected' };
  }
  visitedUrls.add(urlString);

  // Validate the current URL
  const urlValidation = await validateSingleUrl(urlString);
  if (!urlValidation.valid) {
    return { valid: false, error: urlValidation.error };
  }

  // If this is the initial URL and we need to check for redirects
  // We'll make a HEAD request to check for redirects
  if (redirectCount === 0 || redirectCount < MAX_REDIRECTS) {
    const redirectResult = await checkForRedirect(urlString);
    if (redirectResult.hasRedirect && redirectResult.redirectUrl) {
      // Validate the redirect URL
      return followAndValidateRedirects(redirectResult.redirectUrl, redirectCount + 1, visitedUrls);
    }
  }

  return { valid: true };
}

/**
 * Check if a URL redirects and return the redirect location
 */
async function checkForRedirect(urlString: string): Promise<{ hasRedirect: boolean; redirectUrl?: string }> {
  return new Promise((resolve) => {
    const parsedUrl = new URL(urlString);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'HEAD',
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': 'MD2Slide-ImageValidator/1.0',
      },
    };

    const req = https.request(options, (res) => {
      const statusCode = res.statusCode || 0;

      // Check for redirect status codes
      if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
        try {
          // Resolve relative redirect URLs
          const redirectUrl = new URL(res.headers.location, urlString).href;
          resolve({ hasRedirect: true, redirectUrl });
        } catch {
          resolve({ hasRedirect: false });
        }
      } else {
        resolve({ hasRedirect: false });
      }
    });

    req.on('error', () => {
      // If we can't check for redirects, we'll proceed with validation
      resolve({ hasRedirect: false });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ hasRedirect: false });
    });

    req.end();
  });
}

/**
 * Validates an image URL for SSRF prevention
 *
 * @param url - The image URL to validate
 * @returns Promise<ImageValidationResult> with valid status and optional error message
 */
export async function validateImageUrl(url: string): Promise<ImageValidationResult> {
  // Check for null/undefined input
  if (url === null || url === undefined) {
    return {
      valid: false,
      error: 'Image URL is required',
    };
  }

  // Ensure url is a string
  if (typeof url !== 'string') {
    return {
      valid: false,
      error: 'Image URL must be a string',
    };
  }

  // Trim whitespace
  const trimmedUrl = url.trim();

  // Check for empty URL
  if (trimmedUrl.length === 0) {
    return {
      valid: false,
      error: 'Image URL cannot be empty',
    };
  }

  // Check for control characters
  if (/[\x00-\x1F\x7F]/.test(trimmedUrl)) {
    return {
      valid: false,
      error: 'Image URL contains invalid characters',
    };
  }

  // Check for common URL obfuscation attempts
  // URL-encoded @ symbol (could be used for credential tricks)
  if (trimmedUrl.includes('%40')) {
    return {
      valid: false,
      error: 'Invalid URL format',
    };
  }

  // Check for backslashes (Windows path trick)
  if (trimmedUrl.includes('\\')) {
    return {
      valid: false,
      error: 'Invalid URL format',
    };
  }

  // Check for double slashes after protocol (could indicate path traversal)
  if (/^https?:\/\/[^/]*\/\//.test(trimmedUrl)) {
    return {
      valid: false,
      error: 'Invalid URL format',
    };
  }

  // Follow redirects and validate all URLs in the chain
  try {
    return await followAndValidateRedirects(trimmedUrl);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown validation error';
    // Log for debugging but don't expose internal details
    console.error('[ImageURLValidator] Validation error:', errorMessage);
    return {
      valid: false,
      error: 'Failed to validate image URL',
    };
  }
}

/**
 * Validate multiple image URLs at once
 *
 * @param urls - Array of image URLs to validate
 * @returns Promise with array of results for each URL
 */
export async function validateImageUrls(urls: string[]): Promise<ImageValidationResult[]> {
  return Promise.all(urls.map((url) => validateImageUrl(url)));
}
