import { describe, expect, it } from 'vitest';
import {
  comboBase, expand, filterRecipes, flatten, isUpgrade, pickRecipe, rawMaterials, recipesFor, usedIn,
  type Profession, type Recipe,
} from '../src/lib/recipes';
import data from '../src/data/crafting.json';

const r = (id: string, product: string, materials: [string, number][], extra: Partial<Recipe> = {}): Recipe => ({
  id, product, qty: 1, mastery: 10, success: { min: 90, max: 99 }, faction: 'both',
  materials: materials.map(([name, qty]) => ({ name, qty })), ...extra,
});

const sample: Profession[] = [
  {
    id: 'blacksmithing', name: { pt: 'Ferraria', en: 'Blacksmithing' }, recipes: [
      r('ingot', 'Orichalcum Ingot', [['Orichalcum Ore', 2], ['Solvent', 1]], { mastery: 1 }),
      r('ingot10', 'Orichalcum Ingot', [['Orichalcum Ore', 20], ['Solvent', 10]], { mastery: 25, qty: 10 }),
      r('sword', 'Orichalcum Longsword', [['Orichalcum Ingot', 3], ['Odyle', 1]], { mastery: 3 }),
      r('expert', "Expert's Orichalcum Longsword", [['Splendent Orichalcum Longsword', 1], ['Orichalcum Ingot', 5]], { mastery: 15 }),
      r('up', 'Splendent True Sword', [['Horn', 2]], { mastery: 0, success: null, faction: 'elyos' }),
      r('up-a', 'Splendent Star Sword', [['Horn', 2]], { mastery: 0, success: null, faction: 'asmodian' }),
    ],
  },
  {
    id: 'cooking', name: { pt: 'Culinária', en: 'Cooking' }, recipes: [
      r('salad-e', 'Fruit Salad', [['Verteron Pepper', 1]], { faction: 'elyos', mastery: 1 }),
      r('salad-a', 'Fruit Salad', [['Altgard Pepper', 1]], { faction: 'asmodian', mastery: 1 }),
    ],
  },
];
const rows = flatten(sample);

describe('filtro de receitas', () => {
  it('filtra por profissão, maestria e texto sem acento nem maiúscula', () => {
    expect(filterRecipes(rows, { profession: 'cooking' }).map((x) => x.id)).toEqual(['salad-e', 'salad-a']);
    expect(filterRecipes(rows, { minMastery: 10, maxMastery: 30 }).map((x) => x.id)).toEqual(['ingot10', 'expert']);
    expect(filterRecipes(rows, { text: 'ORICHALCUM  ore' }).map((x) => x.id)).toEqual(['ingot', 'ingot10']);
    expect(filterRecipes(rows, { text: 'pepper' }).length).toBe(2);
  });

  it('facção mostra as receitas dela e as comuns', () => {
    const elyos = filterRecipes(rows, { faction: 'elyos' }).map((x) => x.id);
    expect(elyos).toContain('salad-e');
    expect(elyos).toContain('ingot');
    expect(elyos).not.toContain('salad-a');
    expect(elyos).not.toContain('up-a');
  });

  it('maestria 0 é receita de evolução', () => {
    expect(rows.filter(isUpgrade).map((x) => x.id)).toEqual(['up', 'up-a']);
  });
});

describe('usado em e receita de um item', () => {
  it('acha as receitas que pedem um material', () => {
    expect(usedIn(rows, 'orichalcum ingot').map((x) => x.id)).toEqual(['sword', 'expert']);
    expect(usedIn(rows, 'Horn', 'asmodian').map((x) => x.id)).toEqual(['up-a']);
    expect(usedIn(rows, 'Nada')).toEqual([]);
  });

  it('escolhe a receita normal de menor maestria', () => {
    expect(recipesFor(rows, 'Orichalcum Ingot')).toHaveLength(2);
    expect(pickRecipe(rows, 'Orichalcum Ingot')?.id).toBe('ingot');
    expect(pickRecipe(rows, 'Fruit Salad', 'asmodian')?.id).toBe('salad-a');
  });

  it('peça Splendent aponta para a receita que dá o combo', () => {
    expect(comboBase(rows, 'Splendent Orichalcum Longsword')).toBe('Orichalcum Longsword');
    expect(comboBase(rows, "Artisan's Splendent Nothing")).toBeUndefined();
    expect(comboBase(rows, 'Orichalcum Ingot')).toBeUndefined();
  });
});

describe('árvore de materiais', () => {
  it('abre os itens fabricáveis até os brutos', () => {
    const tree = expand(rows, "Expert's Orichalcum Longsword", 2);
    expect(tree.crafts).toBe(2);
    expect(rawMaterials(tree)).toEqual({ 'Splendent Orichalcum Longsword': 2, 'Orichalcum Ore': 20, Solvent: 10 });
  });

  it('arredonda para cima nas receitas em lote', () => {
    const batch = [r('b', 'Paper', [['Log', 1]], { qty: 3 })];
    const tree = expand(batch, 'Paper', 4);
    expect(tree.crafts).toBe(2);
    expect(rawMaterials(tree)).toEqual({ Log: 2 });
  });

  it('não entra em ciclo', () => {
    const loop = [r('a', 'A', [['B', 1]]), r('b', 'B', [['A', 2], ['C', 1]])];
    const tree = expand(loop, 'A', 1);
    const b = tree.children[0];
    expect(b.children[0]).toMatchObject({ name: 'A', qty: 2, cycle: true });
    expect(rawMaterials(tree)).toEqual({ A: 2, C: 1 });
  });

  it('item sem receita é uma folha', () => {
    expect(expand(rows, 'Odyle', 3)).toEqual({ name: 'Odyle', qty: 3, children: [] });
  });
});

describe('dados do Shugo.GG', () => {
  const profs = data.professions as Profession[];
  const all = flatten(profs);

  it('tem as cinco profissões, todas com receitas e nome nos dois idiomas', () => {
    expect(profs.map((p) => p.id).sort()).toEqual(['alchemy', 'armorsmithing', 'blacksmithing', 'cooking', 'handicrafting']);
    for (const p of profs) {
      expect(p.recipes.length, p.id).toBeGreaterThan(0);
      expect(p.name.pt).toBeTruthy();
      expect(p.name.en).toBeTruthy();
    }
  });

  it('toda receita tem material, quantidade e maestria válidas', () => {
    for (const x of all) {
      expect(x.materials.length, x.id).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(x.mastery) && x.mastery >= 0 && x.mastery <= 100, x.id).toBe(true);
      expect(x.qty, x.id).toBeGreaterThan(0);
      for (const m of x.materials) {
        expect(m.name.trim(), x.id).toBe(m.name);
        expect(m.name, x.id).not.toMatch(/[<>&]/);
        expect(m.qty, x.id).toBeGreaterThan(0);
      }
      if (x.success) {
        expect(x.success.min, x.id).toBeGreaterThan(0);
        expect(x.success.min, x.id).toBeLessThanOrEqual(x.success.max);
        expect(x.success.max, x.id).toBeLessThanOrEqual(100);
      }
    }
  });

  it('ids únicos e as 512 linhas da origem batem com os pares de facção', () => {
    expect(new Set(all.map((x) => x.id)).size).toBe(all.length);
    const lines = all.reduce((n, x) => n + (x.faction === 'both' ? 2 : 1), 0);
    expect(lines).toBe(512);
    expect(all.filter((x) => x.faction === 'elyos').length).toBe(all.filter((x) => x.faction === 'asmodian').length);
  });

  it('receitas de evolução não pedem maestria; as outras pedem', () => {
    const up = all.filter(isUpgrade);
    expect(up.length).toBeGreaterThan(0);
    expect(all.filter((x) => !isUpgrade(x)).every((x) => x.mastery >= 1)).toBe(true);
  });

  it('o True Dragon Lord Longsword abre até a essência Balaur (2 por chifre, 22 chifres)', () => {
    const tree = expand(all, 'True Dragon Lord Longsword', 1, { faction: 'elyos' });
    const raw = rawMaterials(tree);
    expect(raw["Balaur's Essence"]).toBe(44);
    expect(raw["Artisan's Splendent Orichalcum Longsword"]).toBe(1);
  });
});
