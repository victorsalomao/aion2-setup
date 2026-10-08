/**
 * Aprimoramento de +10 a +15 em peça Única.
 * Cada falha soma PITY à chance da próxima tentativa no mesmo nível, até garantir.
 */
export const PITY = 0.05;

export interface EnhanceStep {
  from: number;
  to: number;
  baseRate: number;
}

export const RISKY_STEPS: EnhanceStep[] = [
  { from: 10, to: 11, baseRate: 0.65 },
  { from: 11, to: 12, baseRate: 0.5 },
  { from: 12, to: 13, baseRate: 0.35 },
  { from: 13, to: 14, baseRate: 0.25 },
  { from: 14, to: 15, baseRate: 0.2 },
];

/** número médio de tentativas até passar, contando o bônus por falha */
export function expectedAttempts(baseRate: number, pity = PITY): number {
  let reach = 1; // probabilidade de chegar à tentativa k
  let expected = 0;
  for (let k = 0; reach > 1e-12; k++) {
    expected += reach;
    const p = Math.min(1, baseRate + pity * k);
    reach *= 1 - p;
    if (p >= 1) break;
  }
  return expected;
}

/** pior caso: tentativas até a chance bater 100% */
export function worstCaseAttempts(baseRate: number, pity = PITY): number {
  return Math.round((1 - baseRate) / pity) + 1;
}
