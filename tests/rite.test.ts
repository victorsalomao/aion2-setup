import { describe, expect, it } from 'vitest';
import { formatClock, hardCrystals, highestDifficulty, riteScore, secondsNeeded } from '../src/lib/rite';

describe('pontuação do Rito no Hard', () => {
  it('reproduz o exemplo da fonte: 11:04 de sobra dá 4.092', () => {
    expect(riteScore(2100, 3, 11 * 60 + 4)).toBe(4092);
  });

  it('calcula o tempo que precisa sobrar para cada marco', () => {
    expect(formatClock(secondsNeeded(3000, 2100, 3))).toBe('5:00');
    expect(formatClock(secondsNeeded(4000, 2100, 3))).toBe('10:34');
    expect(formatClock(secondsNeeded(5000, 2100, 3))).toBe('16:07');
  });

  it('marco abaixo da base não pede tempo', () => {
    expect(secondsNeeded(1000, 2100, 3)).toBe(0);
  });

  it('escolhe a dificuldade mais alta que o gear score libera', () => {
    expect(highestDifficulty(2036)?.id).toBe('hard');
    expect(highestDifficulty(2500)?.id).toBe('challenge');
    expect(highestDifficulty(900)).toBeUndefined();
  });

  it('no Hard conta no máximo 3 cristais, mesmo com pontuação alta', () => {
    expect(hardCrystals(2100)).toBe(1);
    expect(hardCrystals(riteScore(2100, 3, 11 * 60 + 4))).toBe(3);
    expect(hardCrystals(9999)).toBe(3);
  });
});
