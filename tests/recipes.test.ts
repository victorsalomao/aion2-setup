import { describe, expect, it } from 'vitest';
import {
  comboSource, expand, filterRecipes, findItem, flatten, iconUrl, isUpgrade, normalize, pickRecipe, rawMaterials, recipesFor, usedIn,
  type ItemDb, type Profession, type Recipe,
} from '../src/lib/recipes';
import data from '../src/data/crafting.json';

const r = (id: number, product: number, materials: [number, number][], extra: Partial<Recipe> = {}): Recipe => ({
  id, product, qty: 1, mastery: 10, success: { min: 90, max: 99 }, combo: 0, faction: 'both',
  materials: materials.map(([mid, qty]) => ({ id: mid, qty })), ...extra,
});

// ids de mentira, nomes nos dois idiomas
const ORE = 1, SOLVENT = 2, INGOT = 3, ODYLE = 4, SWORD = 5, SPL_SWORD = 6, EXPERT = 7, HORN = 8, TRUE_SW = 9, STAR_SW = 10,
  PEPPER_E = 11, PEPPER_A = 12, SALAD = 13;
const items: ItemDb = {
  [ORE]: { en: 'Orichalcum Ore', pt: 'Minério de Oricalco', icon: 'a.webp' },
  [SOLVENT]: { en: 'Solvent', pt: 'Solvente', icon: 'b.webp' },
  [INGOT]: { en: 'Orichalcum Ingot', pt: 'Lingote de Oricalco', icon: 'c.webp' },
  [ODYLE]: { en: 'Odyle', pt: 'Od', icon: 'd.webp' },
  [SWORD]: { en: 'Orichalcum Longsword', pt: 'Espada Longa de Oricalco', icon: 'e.webp' },
  [SPL_SWORD]: { en: 'Splendent Orichalcum Longsword', pt: 'Espada Longa de Oricalco Brilhante', icon: 'f.webp' },
  [EXPERT]: { en: "Expert's Orichalcum Longsword", pt: 'Espada Longa de Oricalco do Magistral', icon: 'g.webp' },
  [HORN]: { en: 'Horn', pt: 'Chifre', icon: 'h.webp' },
  [TRUE_SW]: { en: 'Splendent True Sword', pt: 'Espada Verdadeira Brilhante', icon: 'i.webp' },
  [STAR_SW]: { en: 'Splendent Star Sword', pt: 'Espada Estelar Brilhante', icon: 'j.webp' },
  [PEPPER_E]: { en: 'Verteron Pepper', pt: 'Pimenta de Verteron', icon: 'k.webp' },
  [PEPPER_A]: { en: 'Altgard Pepper', pt: 'Pimenta de Altgard', icon: 'l.webp' },
  [SALAD]: { en: 'Fruit Salad', pt: 'Salada de Frutas', icon: 'm.webp' },
};

const sample: Profession[] = [
  {
    id: 'blacksmithing', name: { pt: 'Armaria', en: 'Blacksmithing' }, recipes: [
      r(101, INGOT, [[ORE, 2], [SOLVENT, 1]], { mastery: 1 }),
      r(102, INGOT, [[ORE, 20], [SOLVENT, 10]], { mastery: 25, qty: 10 }),
      r(103, SWORD, [[INGOT, 3], [ODYLE, 1]], { mastery: 3, combo: 25, comboResult: SPL_SWORD }),
      r(104, EXPERT, [[SPL_SWORD, 1], [INGOT, 5]], { mastery: 15 }),
      r(105, TRUE_SW, [[HORN, 2]], { mastery: 0, success: null, faction: 'elyos' }),
      r(106, STAR_SW, [[HORN, 2]], { mastery: 0, success: null, faction: 'asmodian' }),
    ],
  },
  {
    id: 'cooking', name: { pt: 'Culinária', en: 'Cooking' }, recipes: [
      r(201, SALAD, [[PEPPER_E, 1]], { faction: 'elyos', mastery: 1 }),
      r(202, SALAD, [[PEPPER_A, 1]], { faction: 'asmodian', mastery: 1 }),
    ],
  },
];
const rows = flatten(sample);

describe('filtro de receitas', () => {
  it('filtra por profissão, maestria e texto sem acento nem maiúscula', () => {
    expect(filterRecipes(rows, { profession: 'cooking' }, items).map((x) => x.id)).toEqual([201, 202]);
    expect(filterRecipes(rows, { minMastery: 10, maxMastery: 30 }, items).map((x) => x.id)).toEqual([102, 104]);
    expect(filterRecipes(rows, { text: 'ORICHALCUM  ore' }, items).map((x) => x.id)).toEqual([101, 102]);
    expect(filterRecipes(rows, { text: 'pepper' }, items).length).toBe(2);
  });

  it('a busca acha pelo nome em português e em inglês', () => {
    expect(filterRecipes(rows, { text: 'minerio oricalco' }, items).map((x) => x.id)).toEqual([101, 102]);
    expect(filterRecipes(rows, { text: 'PIMENTA verteron' }, items).map((x) => x.id)).toEqual([201]);
    expect(filterRecipes(rows, { text: 'salada' }, items).map((x) => x.id)).toEqual([201, 202]);
  });

  it('facção mostra as receitas dela e as comuns', () => {
    const elyos = filterRecipes(rows, { faction: 'elyos' }, items).map((x) => x.id);
    expect(elyos).toContain(201);
    expect(elyos).toContain(101);
    expect(elyos).not.toContain(202);
    expect(elyos).not.toContain(106);
  });

  it('maestria 0 é receita de evolução', () => {
    expect(rows.filter(isUpgrade).map((x) => x.id)).toEqual([105, 106]);
  });
});

describe('usado em e receita de um item', () => {
  it('acha as receitas que pedem um material', () => {
    expect(usedIn(rows, INGOT).map((x) => x.id)).toEqual([103, 104]);
    expect(usedIn(rows, HORN, 'asmodian').map((x) => x.id)).toEqual([106]);
    expect(usedIn(rows, 999)).toEqual([]);
  });

  it('escolhe a receita normal de menor maestria', () => {
    expect(recipesFor(rows, INGOT)).toHaveLength(2);
    expect(pickRecipe(rows, INGOT)?.id).toBe(101);
    expect(pickRecipe(rows, SALAD, 'asmodian')?.id).toBe(202);
  });

  it('peça Splendent aponta para a receita que dá o combo', () => {
    expect(comboSource(rows, SPL_SWORD)?.product).toBe(SWORD);
    expect(comboSource(rows, INGOT)).toBeUndefined();
  });

  it('acha item por id ou por nome em qualquer idioma', () => {
    expect(findItem(items, String(INGOT))).toBe(INGOT);
    expect(findItem(items, 'orichalcum ingot')).toBe(INGOT);
    expect(findItem(items, 'Lingote de Oricalco')).toBe(INGOT);
    expect(findItem(items, 'nada')).toBeUndefined();
  });

  it('normaliza acento e apóstrofo', () => {
    expect(normalize('  Maça do Lorde ’X’ ')).toBe("maca do lorde 'x'");
  });
});

describe('árvore de materiais', () => {
  it('abre os itens fabricáveis até os brutos', () => {
    const tree = expand(rows, EXPERT, 2);
    expect(tree.crafts).toBe(2);
    expect(rawMaterials(tree)).toEqual({ [SPL_SWORD]: 2, [ORE]: 20, [SOLVENT]: 10 });
  });

  it('arredonda para cima nas receitas em lote', () => {
    const batch = [r(1, 50, [[51, 1]], { qty: 3 })];
    const tree = expand(batch, 50, 4);
    expect(tree.crafts).toBe(2);
    expect(rawMaterials(tree)).toEqual({ 51: 2 });
  });

  it('não entra em ciclo', () => {
    const loop = [r(1, 60, [[61, 1]]), r(2, 61, [[60, 2], [62, 1]])];
    const tree = expand(loop, 60, 1);
    const b = tree.children[0];
    expect(b.children[0]).toMatchObject({ id: 60, qty: 2, cycle: true });
    expect(rawMaterials(tree)).toEqual({ 60: 2, 62: 1 });
  });

  it('item sem receita é uma folha', () => {
    expect(expand(rows, ODYLE, 3)).toEqual({ id: ODYLE, qty: 3, children: [] });
  });
});

describe('dados da MetaBot.GG + Shugo.GG', () => {
  const profs = data.professions as Profession[];
  const db = data.items as ItemDb;
  const all = flatten(profs);

  it('tem as cinco profissões, todas com receitas e nome nos dois idiomas', () => {
    expect(profs.map((p) => p.id).sort()).toEqual(['alchemy', 'armorsmithing', 'blacksmithing', 'cooking', 'handicrafting']);
    for (const p of profs) {
      expect(p.recipes.length, p.id).toBeGreaterThan(0);
      expect(p.name.pt).toBeTruthy();
      expect(p.name.en).toBeTruthy();
    }
  });

  it('todo item usado tem nome em inglês e português e ícone da MetaBot', () => {
    const ids = new Set(all.flatMap((x) => [x.product, ...x.materials.map((m) => m.id), ...(x.comboResult ? [x.comboResult] : [])]));
    expect(ids.size).toBeGreaterThan(600);
    for (const id of ids) {
      const it = db[id];
      expect(it, String(id)).toBeDefined();
      expect(it.en.trim(), String(id)).toBe(it.en);
      expect(it.en.length, String(id)).toBeGreaterThan(1);
      expect(it.pt.length, String(id)).toBeGreaterThan(1);
      expect(it.icon, String(id)).toMatch(/^[\w.-]+\.webp$/);
      expect(iconUrl(it.icon)).toMatch(/^https:\/\/metabot\.gg\/web\/aion2\/items\/[\w.-]+\.webp$/);
    }
    expect(data.iconBase).toBe('https://metabot.gg/web/aion2/items/');
  });

  it('o português veio da página pt, não é cópia do inglês', () => {
    const items = Object.values(db);
    const same = items.filter((it) => it.pt === it.en).length;
    // só nomes próprios de ingrediente (Inina, Conide, Cypri...) ficam iguais
    expect(same / items.length).toBeLessThan(0.05);
    expect(db['110830015']).toMatchObject({ en: 'True Dragon Lord Staff', pt: 'Cajado do Lorde Dragão Verdadeiro' });
  });

  it('toda receita tem material, quantidade e maestria válidas', () => {
    for (const x of all) {
      expect(x.materials.length, String(x.id)).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(x.mastery) && x.mastery >= 0 && x.mastery <= 100, String(x.id)).toBe(true);
      expect(x.qty, String(x.id)).toBeGreaterThan(0);
      expect([0, 20, 25, 30], String(x.id)).toContain(x.combo);
      for (const m of x.materials) expect(m.qty, String(x.id)).toBeGreaterThan(0);
      if (x.success) {
        expect(x.success.min, String(x.id)).toBeGreaterThan(0);
        expect(x.success.min, String(x.id)).toBeLessThanOrEqual(x.success.max);
        expect(x.success.max, String(x.id)).toBeLessThanOrEqual(100);
      }
    }
  });

  it('ids únicos e as 512 receitas do cliente batem com os pares de facção', () => {
    expect(new Set(all.map((x) => x.id)).size).toBe(all.length);
    const lines = all.reduce((n, x) => n + (x.faction === 'both' ? 2 : 1), 0);
    expect(lines).toBe(512);
    expect(all.filter((x) => x.faction === 'elyos').length).toBe(all.filter((x) => x.faction === 'asmodian').length);
  });

  it('receitas de evolução não pedem maestria nem têm chance listada; as outras pedem', () => {
    const up = all.filter(isUpgrade);
    expect(up.length).toBe(190);
    expect(up.every((x) => x.success === null)).toBe(true);
    expect(all.filter((x) => !isUpgrade(x)).every((x) => x.mastery >= 1)).toBe(true);
  });

  it('o combo do Artisan dá a peça Splendent da mesma facção', () => {
    const artisan = all.find((x) => x.id === 211104001)!;
    expect(db[artisan.product].en).toBe("Artisan's Yggdrasil Staff");
    expect(db[artisan.comboResult!].en).toBe("Artisan's Splendent Yggdrasil Staff");
    expect(comboSource(all, artisan.comboResult!)?.id).toBe(211104001);
  });

  it('o True Dragon Lord Longsword abre até a essência Balaur (2 por chifre, 22 chifres)', () => {
    const sword = findItem(db, 'True Dragon Lord Longsword')!;
    const tree = expand(all, sword, 1, { faction: 'elyos' });
    const raw = rawMaterials(tree);
    const essence = findItem(db, "Balaur's Essence")!;
    expect(raw[essence]).toBe(44);
    const base = all.find((x) => x.product === sword)!.materials[0].id;
    expect(db[base].en).toBe("Artisan's Splendent Orichalcum Longsword");
    expect(raw[base]).toBe(1);
  });
});
