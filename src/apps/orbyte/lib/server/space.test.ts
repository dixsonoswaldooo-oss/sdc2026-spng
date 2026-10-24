import { describe, expect, it } from 'vitest';
import { isSpaceCode, newSpaceCode } from './space';

describe('demo space codes', () => {
  it('are 6 easy-to-read characters (no 0/O, 1/I/L) and pass their own check', () => {
    const codes = Array.from({ length: 300 }, newSpaceCode);
    expect(codes.every(isSpaceCode)).toBe(true);
    expect(codes.join('')).not.toMatch(/[01OIL]/);
    expect(new Set(codes).size).toBeGreaterThan(290);
  });

  it('refuse anything else (the code goes into a database key and a cookie)', () => {
    for (const bad of ['', 'ABC12', 'ABCDEFG', 'abcdef', 'AB-DEF', "A'; --", 'K7Q2M0', null, 42]) expect(isSpaceCode(bad)).toBe(false);
    expect(isSpaceCode('K7Q2MX')).toBe(true);
  });
});
