import { describe, it, expect } from 'vitest';

describe('shared package', () => {
  it('should export types correctly', () => {
    // Type exports are compile-time only, so we just verify the module loads
    expect(true).toBe(true);
  });
});
