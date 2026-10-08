import type { L10n } from '../i18n';

/** Barreiras de gear score: o que cada número abre. */
export interface Gate {
  gs: number;
  what: L10n;
  minor?: boolean;
}

export const GATES: Gate[] = [
  { gs: 1000, what: { pt: 'Conquista: Krao Cave e Draupnir', en: 'Conquest: Krao Cave and Draupnir' } },
  { gs: 1400, what: { pt: 'Conquista: Urugugu Canyon e Vakron Sky Island (peças de nível 70)', en: 'Conquest: Urugugu Canyon and Vakron Sky Island (item level 70 gear)' } },
  { gs: 1500, what: { pt: 'Rito da Ascensão normal', en: 'Ascension Trial, Normal' }, minor: true },
  { gs: 1600, what: { pt: 'Transcendência estágio 1: primeiras cartas Arcana', en: 'Transcendence stage 1: first Arcana cards' } },
  { gs: 1900, what: { pt: 'Transcendência estágio 2: cartas de +40', en: 'Transcendence stage 2: +40 cards' } },
  { gs: 2000, what: { pt: 'Rito da Ascensão difícil', en: 'Ascension Trial, Hard' }, minor: true },
  { gs: 2100, what: { pt: 'Conquista: Fire Temple e Ferocious Horn Den (peças de nível 86)', en: 'Conquest: Fire Temple and Ferocious Horn Den (item level 86 gear)' } },
  { gs: 2200, what: { pt: 'Transcendência estágio 3: cartas de +60', en: 'Transcendence stage 3: +60 cards' } },
  { gs: 2500, what: { pt: 'Transcendência estágio 4 e Rito da Ascensão Challenge', en: 'Transcendence stage 4 and Ascension Trial, Challenge' } },
  { gs: 2800, what: { pt: 'Santuário: raide de 10 jogadores', en: 'Sanctuary: 10-player raid' } },
];

export function nextGate(gs: number): Gate | undefined {
  return GATES.find((g) => g.gs > gs);
}

export function transcendenceStage(gs: number): 0 | 1 | 2 | 3 | 4 {
  return gs >= 2500 ? 4 : gs >= 2200 ? 3 : gs >= 1900 ? 2 : gs >= 1600 ? 1 : 0;
}
