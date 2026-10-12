/**
 * Pontuação do Rito da Ascensão (Ascension Trial).
 * Fórmula relatada por jogadores da versão coreana: base por terminar sem morrer,
 * mais um multiplicador da dificuldade por segundo que sobra no relógio.
 * Só o Hard tem números confirmados por fonte; as outras ficam sem valor de propósito.
 */
export interface RiteDifficulty {
  id: 'easy' | 'normal' | 'hard' | 'challenge' | 'insane' | 'hell';
  gearScore: number;
  deathLimit: number;
  /** pontos por terminar sem morrer; undefined = sem fonte */
  base?: number;
  /** pontos por segundo que sobra; undefined = sem fonte */
  perSecond?: number;
}

export const RITE_DIFFICULTIES: RiteDifficulty[] = [
  { id: 'easy', gearScore: 1000, deathLimit: 5 },
  { id: 'normal', gearScore: 1500, deathLimit: 3 },
  { id: 'hard', gearScore: 2000, deathLimit: 2, base: 2100, perSecond: 3 },
  { id: 'challenge', gearScore: 2500, deathLimit: 2 },
  { id: 'insane', gearScore: 3000, deathLimit: 2 },
  { id: 'hell', gearScore: 3500, deathLimit: 2 },
];

/** marcos da conquista Tower of Trials que pagam Cristal Misterioso (versão coreana) */
export const CRYSTAL_MILESTONES = [1000, 3000, 4000, 5000, 6000];

/**
 * Marcos que dá para bater no Hard. Os de 5.000 e 6.000 pediriam 16 e 21 minutos de
 * sobra, o que não acontece na prática: eles saem no Challenge (guia unique-arcana).
 */
export const HARD_MILESTONES = CRYSTAL_MILESTONES.filter((m) => m <= 4000);

/** cristais que uma pontuação no Hard rende, contando só os marcos alcançáveis nele */
export function hardCrystals(score: number): number {
  return HARD_MILESTONES.filter((m) => score >= m).length;
}

export function riteScore(base: number, perSecond: number, secondsLeft: number): number {
  return base + perSecond * Math.max(0, Math.floor(secondsLeft));
}

/** segundos que precisam sobrar para bater uma pontuação */
export function secondsNeeded(target: number, base: number, perSecond: number): number {
  return Math.max(0, Math.ceil((target - base) / perSecond));
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** dificuldade mais alta que um gear score libera */
export function highestDifficulty(gearScore: number): RiteDifficulty | undefined {
  return [...RITE_DIFFICULTIES].reverse().find((d) => gearScore >= d.gearScore);
}
