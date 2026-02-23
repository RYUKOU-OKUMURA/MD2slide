import { describe, it, expect } from 'vitest';
import { config, type Config } from './config.js';

describe('Config', () => {
  it('should have default values for required config', () => {
    expect(config).toBeDefined();
    expect(config.NODE_ENV).toBeDefined();
    expect(config.PORT).toBeDefined();
    expect(config.HOST).toBeDefined();
    expect(config.FRONTEND_URL).toBeDefined();
  });

  it('should have valid NODE_ENV value', () => {
    expect(['development', 'production', 'test']).toContain(config.NODE_ENV);
  });

  it('should have PORT as a number', () => {
    expect(typeof config.PORT).toBe('number');
    expect(config.PORT).toBeGreaterThan(0);
    expect(config.PORT).toBeLessThan(65536);
  });

  it('should have HOST as a string', () => {
    expect(typeof config.HOST).toBe('string');
    expect(config.HOST.length).toBeGreaterThan(0);
  });

  it('should have FRONTEND_URL as a valid URL', () => {
    expect(typeof config.FRONTEND_URL).toBe('string');
    expect(() => new URL(config.FRONTEND_URL)).not.toThrow();
  });

  it('should have rate limit configuration', () => {
    expect(typeof config.RATE_LIMIT_MAX).toBe('number');
    expect(typeof config.RATE_LIMIT_WINDOW_MS).toBe('number');
    expect(config.RATE_LIMIT_MAX).toBeGreaterThan(0);
    expect(config.RATE_LIMIT_WINDOW_MS).toBeGreaterThan(0);
  });

  it('should have job configuration', () => {
    expect(typeof config.JOB_TIMEOUT_MS).toBe('number');
    expect(typeof config.MAX_FILE_SIZE_BYTES).toBe('number');
    expect(config.JOB_TIMEOUT_MS).toBeGreaterThan(0);
    expect(config.MAX_FILE_SIZE_BYTES).toBeGreaterThan(0);
  });
});
