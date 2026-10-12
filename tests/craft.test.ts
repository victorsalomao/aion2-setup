import { describe, expect, it } from 'vitest';
import { aggregate, expectedCrafts, progress, shortfall } from '../src/lib/craft';
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

describe('dados do Dragon Lord', () => {
  it('toda receita aponta para materiais que existem, com ícone', () => {
    for (const item of data.items) {
      const refs = [...item.tiers.flatMap((t) => t.materials), ...item.base.recipe.materials];
      for (const r of refs) {
        const m = (data.materials as Record<string, { icon: string | null }>)[r.id];
        expect(m, r.id).toBeDefined();
        expect(m.icon, r.id).toMatch(/^https:\/\//);
        expect(r.qty).toBeGreaterThan(0);
      }
    }
  });

  it('tem cajado, anel e guarda com os 6 degraus', () => {
    expect(data.items.map((i) => i.slot)).toEqual(['staff', 'ring', 'guard']);
    for (const item of data.items) {
      expect(item.tiers.map((t) => t.itemLevel)).toEqual([62, 70, 78, 86, 94, 102]);
    }
  });
});
