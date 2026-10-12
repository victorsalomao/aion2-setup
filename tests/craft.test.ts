import { describe, expect, it } from 'vitest';
import { aggregate, expandChain, expectedCrafts, progress, shortfall, type ChainStep } from '../src/lib/craft';
import data from '../src/data/dragon-lord.json';

describe('menu de craft', () => {
  it('soma e multiplica os materiais de várias receitas', () => {
    const total = aggregate([
      { materials: [{ id: 'a', qty: 4 }, { id: 'b', qty: 1 }], count: 2 },
      { materials: [{ id: 'a', qty: 3 }], count: 1 },
      { materials: [{ id: 'c', qty: 9 }], count: 0 },
    ]);
    expect(total).toEqual({ a: 11, b: 2 });
  });

  it('desconta o que você já tem', () => {
    expect(shortfall({ a: 11, b: 2 }, { a: 5, b: 9 })).toEqual({ a: 6 });
  });

  it('progresso fica entre 0 e 1', () => {
    expect(progress(10, 5)).toBe(0.5);
    expect(progress(10, 50)).toBe(1);
    expect(progress(0, 0)).toBe(1);
  });

  it('25% de combo dá 4 fabricações em média', () => {
    expect(expectedCrafts(0.25)).toBe(4);
  });
});

/* escada de mentira com a forma da Dragon Lord: base por combo, True, evoluções */
const ladder: ChainStep[] = [
  { item: 'base', materials: [{ id: 'expert', qty: 1 }, { id: 'stone', qty: 5 }], viaCombo: true },
  { item: 'true', materials: [{ id: 'base', qty: 1 }, { id: 'horn', qty: 22 }] },
  { item: 'sTrue', materials: [{ id: 'true', qty: 1 }, { id: 'horn', qty: 11 }] },
  { item: 'white', materials: [{ id: 'sTrue', qty: 1 }, { id: 'base', qty: 1 }, { id: 'will', qty: 15 }] },
  { item: 'sWhite', materials: [{ id: 'white', qty: 1 }, { id: 'will', qty: 5 }] },
  { item: 'wise', materials: [{ id: 'sWhite', qty: 1 }, { id: 'base', qty: 1 }, { id: 'ego', qty: 20 }] },
  { item: 'sWise', materials: [{ id: 'wise', qty: 1 }, { id: 'ego', qty: 7 }] },
];

describe('escada completa (expandChain)', () => {
  it('do zero até o True: 4 fabricações Artisan em média e 1 True', () => {
    const { lines, total } = expandChain(ladder, 1);
    expect(lines.map((l) => [l.item, l.crafts, l.average])).toEqual([['base', 4, true], ['true', 1, false]]);
    expect(total).toEqual({ expert: 4, stone: 20, horn: 22 });
    expect(lines[1].consumes).toEqual([{ id: 'base', qty: 1 }]);
  });

  it('do zero até o Splendent Wise: 3 bases (12 fabricações) e cada evolução consome o passo anterior', () => {
    const { lines, total } = expandChain(ladder, 6);
    expect(lines.map((l) => l.item)).toEqual(['base', 'true', 'sTrue', 'white', 'sWhite', 'wise', 'sWise']);
    expect(lines[0]).toMatchObject({ need: 3, crafts: 12, average: true });
    expect(lines.slice(1).every((l) => l.crafts === 1)).toBe(true);
    expect(lines[3].consumes).toEqual([{ id: 'sTrue', qty: 1 }, { id: 'base', qty: 1 }]);
    expect(total).toEqual({ expert: 12, stone: 60, horn: 33, will: 20, ego: 27 });
  });

  it('peças que você já tem cortam a demanda', () => {
    const { lines, total } = expandChain(ladder, 3, { owned: { sTrue: 1, base: 1 } });
    expect(lines.map((l) => [l.item, l.crafts])).toEqual([['white', 1]]);
    expect(total).toEqual({ will: 15 });
    const one = expandChain(ladder, 3, { owned: { base: 1 } });
    expect(one.lines[0]).toMatchObject({ item: 'base', need: 1, crafts: 4 });
  });

  it('respeita quantidade e chance de combo', () => {
    const { lines, total } = expandChain(ladder, 1, { count: 2, comboChance: 0.5 });
    expect(lines[0]).toMatchObject({ need: 2, crafts: 4 });
    expect(total.horn).toBe(44);
  });

  it('alvo fora da escada fica no limite', () => {
    expect(expandChain(ladder, 99).lines.at(-1)!.item).toBe('sWise');
    expect(expandChain(ladder, -3).lines.map((l) => l.item)).toEqual(['base']);
  });
});

type Ref = { id: string; qty: number; prev?: boolean };
type Variant = { item: string; recipe: number; materials: Ref[]; craft?: string };
type Step = { tier: string; itemLevel: number; mastery: number | null; upgrade: boolean; elyos: Variant; asmodian: Variant };
const items = data.items as Record<string, { name: { pt: string; en: string }; icon: string; slug: string | null }>;
const pieces = data.pieces as unknown as { slot: string; group: string; name: { pt: string; en: string }; unlock: number; profession: { pt: string; en: string }; steps: Step[] }[];

describe('dados do Dragon Lord', () => {
  it('tem as 19 peças do cliente: 9 armas (com a guarda), 7 de armadura e 3 acessórios', () => {
    const by = (g: string) => pieces.filter((p) => p.group === g).map((p) => p.slot);
    expect(by('weapon')).toEqual(['longsword', 'greatsword', 'dagger', 'mace', 'bow', 'staff', 'spellbook', 'orb', 'guard']);
    expect(by('armor')).toEqual(['breastplate', 'greaves', 'helm', 'pauldrons', 'gloves', 'boots', 'cloak']);
    expect(by('accessory')).toEqual(['necklace', 'earrings', 'ring']);
    expect(new Set(pieces.map((p) => p.slot)).size).toBe(pieces.length);
    for (const p of pieces) {
      expect(p.name.pt && p.name.en && p.profession.pt && p.profession.en, p.slot).toBeTruthy();
      expect([55, 60], p.slot).toContain(p.unlock);
    }
  });

  it('toda peça tem os 7 passos, níveis 44 a 102, e só o Artisan e o True pedem maestria', () => {
    for (const p of pieces) {
      expect(p.steps.map((s) => s.tier), p.slot).toEqual(['artisan', 'true', 'splendent-true', 'white', 'splendent-white', 'wise', 'splendent-wise']);
      expect(p.steps.map((s) => s.itemLevel), p.slot).toEqual([44, 62, 70, 78, 86, 94, 102]);
      expect(p.steps[0].mastery, p.slot).toBeGreaterThan(0);
      expect(p.steps[1].mastery, p.slot).toBe(p.unlock);
      expect(p.steps.slice(2).every((s) => s.upgrade && s.mastery === null), p.slot).toBe(true);
    }
  });

  it('cada evolução consome a peça do passo anterior; White e Wise também uma Artisan\'s Splendent', () => {
    for (const p of pieces) for (const f of ['elyos', 'asmodian'] as const) {
      const v = p.steps.map((s) => s[f]);
      expect(v[1].materials.filter((m) => m.id === v[0].item), `${p.slot} ${f} true`).toEqual([{ id: v[0].item, qty: 1 }]);
      for (let i = 2; i < 7; i++) {
        const prev = v[i].materials.filter((m) => m.prev);
        expect(prev, `${p.slot} ${f} ${i}`).toEqual([{ id: v[i - 1].item, qty: 1, prev: true }]);
        const base = v[i].materials.some((m) => m.id === v[0].item);
        expect(base, `${p.slot} ${f} ${i}`).toBe(i === 3 || i === 5);
      }
    }
  });

  it('nomes Elyos e Asmodianos (True/Star, White/Dark, Wise/Ebony) nos dois idiomas, com ícone', () => {
    const pairs: [number, string, string][] = [[1, 'True', 'Star'], [3, 'White', 'Dark'], [5, 'Wise', 'Ebony']];
    for (const p of pieces) {
      for (const [i, e, a] of pairs) {
        expect(items[p.steps[i].elyos.item].name.en, p.slot).toBe(`${e} Dragon Lord ${p.name.en}`);
        expect(items[p.steps[i].asmodian.item].name.en, p.slot).toBe(`${a} Dragon Lord ${p.name.en}`);
        expect(items[p.steps[i + 1].elyos.item].name.en, p.slot).toBe(`Splendent ${e} Dragon Lord ${p.name.en}`);
      }
      for (const s of p.steps) for (const f of ['elyos', 'asmodian'] as const) {
        const ids = [s[f].item, ...(s[f].craft ? [s[f].craft!] : []), ...s[f].materials.map((m) => m.id)];
        for (const id of ids) {
          const it = items[id];
          expect(it, `${p.slot} ${s.tier} ${id}`).toBeDefined();
          expect(it.name.pt.length > 1 && it.name.en.length > 1, id).toBe(true);
          expect(it.icon, id).toMatch(/^[\w.-]+\.webp$/);
        }
        for (const m of s[f].materials) expect(m.qty, `${p.slot} ${s.tier}`).toBeGreaterThan(0);
      }
    }
    expect(data.iconBase).toBe('https://metabot.gg/web/aion2/items/');
  });

  it('ids de item e de receita únicos dentro de cada facção', () => {
    for (const f of ['elyos', 'asmodian'] as const) {
      const all = pieces.flatMap((p) => p.steps.slice(1).map((s) => s[f]));
      expect(new Set(all.map((v) => v.item)).size, f).toBe(all.length);
      expect(new Set(all.map((v) => v.recipe)).size, f).toBe(all.length);
    }
  });

  it('sem nenhum link ou ícone do th.gl', () => {
    expect(JSON.stringify(data)).not.toMatch(/th\.gl/);
  });

  it('o cajado do zero ao Splendent Wise: 12 Artisan em média e 41 escamas Durable + 21 do último passo', () => {
    const staff = pieces.find((p) => p.slot === 'staff')!;
    const steps = staff.steps.map((s, i) => ({ item: s.elyos.item, materials: s.elyos.materials, viaCombo: i === 0 }));
    const { lines, total } = expandChain(steps, 6);
    expect(lines[0]).toMatchObject({ crafts: 12, average: true });
    const durable = Object.keys(items).find((id) => items[id].name.en === 'Enhanced Durable Balaur Scale')!;
    const ego = Object.keys(items).find((id) => items[id].name.en === 'Wrathful Ego')!;
    expect(total[durable]).toBe(41 + 21);
    expect(total[ego]).toBe(20 + 7);
  });
});
