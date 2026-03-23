import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('测试框架验证', () => {
  it('vitest 正常运行', () => {
    expect(1 + 1).toBe(2);
  });

  it('fast-check 正常运行', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        return a + b === b + a;
      }),
      { numRuns: 100 }
    );
  });
});
