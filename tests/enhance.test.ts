import { describe, expect, it } from 'vitest';
import { expectedAttempts, worstCaseAttempts } from '../src/lib/enhance';

describe('aprimoramento com bônus por falha', () => {
  it('média de tentativas por passo', () => {
    expect(expectedAttempts(0.65)).toBeCloseTo(1.49, 2);
    expect(expectedAttempts(0.5)).toBeCloseTo(1.86, 2);
    expect(expectedAttempts(0.2)).toBeCloseTo(3.42, 2);
  });

  it('pior caso até a chance bater 100%', () => {
    expect(worstCaseAttempts(0.65)).toBe(8);
    expect(worstCaseAttempts(0.2)).toBe(17);
  });

  it('chance de 100% passa na primeira', () => {
    expect(expectedAttempts(1)).toBe(1);
  });
});
