/**
 * Banco de receitas: filtro, "usado em" e árvore de materiais.
 * Funções puras: recebem a lista de receitas (src/data/crafting.json) e devolvem
 * listas e árvores. A tela só chama estas funções e desenha o resultado.
 */

/** "both" = a mesma receita vale para as duas facções */
export type Faction = 'both' | 'elyos' | 'asmodian';

export interface Ingredient {
  name: string;
  qty: number;
}

export interface Recipe {
  id: string;
  product: string;
  /** quantas unidades saem por fabricação */
  qty: number;
  /** 0 = receita de evolução (pega uma peça que você já tem e sobe o degrau) */
  mastery: number;
  /** faixa de sucesso em %: na maestria da receita e com maestria de sobra */
  success: { min: number; max: number } | null;
  materials: Ingredient[];
  faction: Faction;
}

export interface Profession {
  id: string;
  name: { pt: string; en: string };
  recipes: Recipe[];
}

/** receita com a profissão junto, para trabalhar numa lista só */
export interface RecipeRow extends Recipe {
  profession: string;
}

export interface RecipeFilter {
  profession?: string;
  /** "elyos" mostra as receitas Elyos e as comuns às duas facções */
  faction?: Faction;
  minMastery?: number;
  maxMastery?: number;
  /** procura no nome do produto e dos materiais, sem diferenciar maiúscula e acento */
  text?: string;
}

export function flatten(professions: Profession[]): RecipeRow[] {
  return professions.flatMap((p) => p.recipes.map((r) => ({ ...r, profession: p.id })));
}

/** receita de evolução: não pede maestria e não tem chance de sucesso listada */
export function isUpgrade(r: Recipe): boolean {
  return r.mastery === 0;
}

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`]/g, "'").toLowerCase().trim();
}

export function matchesFaction(r: Recipe, faction?: Faction): boolean {
  return !faction || faction === 'both' || r.faction === 'both' || r.faction === faction;
}

export function filterRecipes<T extends RecipeRow>(rows: T[], f: RecipeFilter = {}): T[] {
  const words = normalize(f.text ?? '').split(/\s+/).filter(Boolean);
  const min = f.minMastery ?? -Infinity;
  const max = f.maxMastery ?? Infinity;
  return rows.filter((r) => {
    if (f.profession && r.profession !== f.profession) return false;
    if (!matchesFaction(r, f.faction)) return false;
    if (r.mastery < min || r.mastery > max) return false;
    if (!words.length) return true;
    const hay = normalize([r.product, ...r.materials.map((m) => m.name)].join(' | '));
    return words.every((w) => hay.includes(w));
  });
}

/** receitas que pedem este material */
export function usedIn<T extends Recipe>(rows: T[], material: string, faction?: Faction): T[] {
  const key = normalize(material);
  return rows.filter((r) => matchesFaction(r, faction) && r.materials.some((m) => normalize(m.name) === key));
}

/** receitas que fabricam este item */
export function recipesFor<T extends Recipe>(rows: T[], product: string, faction?: Faction): T[] {
  const key = normalize(product);
  return rows.filter((r) => matchesFaction(r, faction) && normalize(r.product) === key);
}

/**
 * Qual receita usar para fabricar um item quando há mais de uma.
 * Prefere a fabricação normal à evolução, a da facção pedida e a de menor maestria
 * (as versões em lote dão a mesma conta por unidade).
 */
export function pickRecipe<T extends Recipe>(rows: T[], product: string, faction?: Faction): T | undefined {
  const rank = (r: Recipe) => (isUpgrade(r) ? 1000 : 0) + (r.faction === (faction ?? 'both') ? 0 : r.faction === 'both' ? 1 : 2) * 200 + r.mastery;
  return recipesFor(rows, product, faction).sort((a, b) => rank(a) - rank(b))[0];
}

/**
 * Peças "Splendent" de equipamento não têm receita: saem no combo ao fabricar a
 * versão normal. "Artisan's Splendent Orichalcum Longsword" -> "Artisan's Orichalcum Longsword".
 * Devolve o nome da receita base, se ela existir.
 */
export function comboBase(rows: Recipe[], name: string): string | undefined {
  if (!/\bSplendent\s/.test(name)) return undefined;
  const base = name.replace(/\bSplendent\s+/, '');
  return rows.find((r) => normalize(r.product) === normalize(base))?.product;
}

export interface TreeNode {
  name: string;
  /** quanto é preciso deste item */
  qty: number;
  /** receita usada, se o item for fabricável */
  recipe?: string;
  /** quantas fabricações cobrem a quantidade (as receitas em lote fazem várias unidades) */
  crafts?: number;
  children: TreeNode[];
  /** o item já apareceu acima na árvore: parou aqui para não entrar em ciclo */
  cycle?: boolean;
}

export interface ExpandOptions {
  faction?: Faction;
  /** profundidade máxima; protege contra dados ruins além do teste de ciclo */
  maxDepth?: number;
}

/**
 * Abre um item em árvore até os materiais que não se fabricam.
 * Um item que reaparece no próprio caminho vira folha marcada com cycle.
 */
export function expand(rows: Recipe[], name: string, qty = 1, opts: ExpandOptions = {}): TreeNode {
  const maxDepth = opts.maxDepth ?? 12;
  const walk = (item: string, need: number, path: Set<string>, depth: number): TreeNode => {
    const key = normalize(item);
    if (path.has(key)) return { name: item, qty: need, children: [], cycle: true };
    const r = depth < maxDepth ? pickRecipe(rows, item, opts.faction) : undefined;
    if (!r) return { name: item, qty: need, children: [] };
    const crafts = Math.ceil(need / r.qty);
    const next = new Set(path).add(key);
    return {
      name: item,
      qty: need,
      recipe: r.id,
      crafts,
      children: r.materials.map((m) => walk(m.name, m.qty * crafts, next, depth + 1)),
    };
  };
  return walk(name, Math.max(1, Math.floor(qty)), new Set(), 0);
}

/** soma as folhas da árvore: a lista de materiais brutos */
export function rawMaterials(tree: TreeNode): Record<string, number> {
  const out: Record<string, number> = {};
  const visit = (n: TreeNode, root: boolean) => {
    if (!n.children.length && !root) out[n.name] = (out[n.name] ?? 0) + n.qty;
    n.children.forEach((c) => visit(c, false));
  };
  visit(tree, true);
  return out;
}
