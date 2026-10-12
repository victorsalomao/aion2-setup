/**
 * Banco de receitas: filtro, "usado em" e árvore de materiais.
 * Funções puras: recebem a lista de receitas e o mapa de itens
 * (src/data/crafting.json) e devolvem listas e árvores. A tela só chama estas
 * funções e desenha o resultado.
 *
 * Tudo anda pelo id do item do jogo, não pelo nome: o mesmo nome pode existir
 * nas duas facções com ids diferentes, e o nome muda com o idioma.
 */

/** "both" = a mesma receita vale para as duas facções */
export type Faction = 'both' | 'elyos' | 'asmodian';
export type Lang = 'pt' | 'en';
export type ItemId = number;

/** pasta dos ícones estáticos da MetaBot.GG (nunca a rota /api/image) */
export const ICON_BASE = 'https://metabot.gg/web/aion2/items/';

export interface Item {
  en: string;
  pt: string;
  /** nome do arquivo do ícone em ICON_BASE, ex.: "icon_wp_st_0036_t05.webp" */
  icon: string;
  grade?: string;
  /** página do item na MetaBot.GG: /<idioma>/aion-2/items/<slug> */
  slug?: string | null;
  /** material de coleta (Extração de Essência) */
  gather?: boolean;
}
export type ItemDb = Record<string, Item>;

export interface Ingredient {
  id: ItemId;
  qty: number;
}

export interface Recipe {
  /** id da receita no cliente; na linha "both", o da versão Elyos */
  id: number;
  product: ItemId;
  /** quantas unidades saem por fabricação */
  qty: number;
  /** 0 = receita de evolução (pega uma peça que você já tem e sobe o degrau) */
  mastery: number;
  /** faixa de sucesso em %: na maestria da receita e com maestria de sobra */
  success: { min: number; max: number } | null;
  /** chance de combo (grande sucesso) em %, depois de uma fabricação bem-sucedida */
  combo: number;
  /** item que sai no combo, quando é uma peça Splendent */
  comboResult?: ItemId;
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
  /** procura no nome do produto e dos materiais, em português e inglês, sem diferenciar maiúscula e acento */
  text?: string;
}

export function flatten(professions: Profession[]): RecipeRow[] {
  return professions.flatMap((p) => p.recipes.map((r) => ({ ...r, profession: p.id })));
}

export function iconUrl(file: string): string {
  return ICON_BASE + file;
}

export function itemName(items: ItemDb, id: ItemId, lang: Lang): string {
  const it = items[id];
  return it ? it[lang] : String(id);
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

/** texto de busca de uma receita: produto e materiais nos dois idiomas, já normalizado */
export function searchText(r: Recipe, items: ItemDb): string {
  const ids = [r.product, ...r.materials.map((m) => m.id)];
  return normalize(ids.map((id) => `${items[id]?.en ?? ''} | ${items[id]?.pt ?? ''}`).join(' | '));
}

const hayCache = new WeakMap<Recipe, string>();
function hay(r: Recipe, items: ItemDb): string {
  let h = hayCache.get(r);
  if (h === undefined) { h = searchText(r, items); hayCache.set(r, h); }
  return h;
}

export function filterRecipes<T extends RecipeRow>(rows: T[], f: RecipeFilter = {}, items: ItemDb = {}): T[] {
  const words = normalize(f.text ?? '').split(/\s+/).filter(Boolean);
  const min = f.minMastery ?? -Infinity;
  const max = f.maxMastery ?? Infinity;
  return rows.filter((r) => {
    if (f.profession && r.profession !== f.profession) return false;
    if (!matchesFaction(r, f.faction)) return false;
    if (r.mastery < min || r.mastery > max) return false;
    if (!words.length) return true;
    const h = hay(r, items);
    return words.every((w) => h.includes(w));
  });
}

/** receitas que pedem este material */
export function usedIn<T extends Recipe>(rows: T[], material: ItemId, faction?: Faction): T[] {
  return rows.filter((r) => matchesFaction(r, faction) && r.materials.some((m) => m.id === material));
}

/** receitas que fabricam este item */
export function recipesFor<T extends Recipe>(rows: T[], product: ItemId, faction?: Faction): T[] {
  return rows.filter((r) => matchesFaction(r, faction) && r.product === product);
}

/**
 * Qual receita usar para fabricar um item quando há mais de uma.
 * Prefere a fabricação normal à evolução, a da facção pedida e a de menor maestria
 * (as versões em lote dão a mesma conta por unidade).
 */
export function pickRecipe<T extends Recipe>(rows: T[], product: ItemId, faction?: Faction): T | undefined {
  const rank = (r: Recipe) => (isUpgrade(r) ? 1000 : 0) + (r.faction === (faction ?? 'both') ? 0 : r.faction === 'both' ? 1 : 2) * 200 + r.mastery;
  return recipesFor(rows, product, faction).sort((a, b) => rank(a) - rank(b))[0];
}

/**
 * Receita que dá este item no combo (grande sucesso), se houver.
 * As peças Splendent de equipamento fora do Dragon Lord só saem assim.
 * Prefere a fabricação normal à evolução.
 */
export function comboSource<T extends Recipe>(rows: T[], item: ItemId, faction?: Faction): T | undefined {
  const found = rows.filter((r) => r.comboResult === item && matchesFaction(r, faction));
  return found.find((r) => !isUpgrade(r)) ?? found[0];
}

/** acha um item pelo id ou pelo nome exato (em qualquer idioma) */
export function findItem(items: ItemDb, key: string): ItemId | undefined {
  if (/^\d+$/.test(key) && items[key]) return Number(key);
  const k = normalize(key);
  const hit = Object.entries(items).find(([, it]) => normalize(it.en) === k || normalize(it.pt) === k);
  return hit ? Number(hit[0]) : undefined;
}

export interface TreeNode {
  id: ItemId;
  /** quanto é preciso deste item */
  qty: number;
  /** receita usada, se o item for fabricável */
  recipe?: number;
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
export function expand(rows: Recipe[], id: ItemId, qty = 1, opts: ExpandOptions = {}): TreeNode {
  const maxDepth = opts.maxDepth ?? 12;
  const walk = (item: ItemId, need: number, path: Set<ItemId>, depth: number): TreeNode => {
    if (path.has(item)) return { id: item, qty: need, children: [], cycle: true };
    const r = depth < maxDepth ? pickRecipe(rows, item, opts.faction) : undefined;
    if (!r) return { id: item, qty: need, children: [] };
    const crafts = Math.ceil(need / r.qty);
    const next = new Set(path).add(item);
    return {
      id: item,
      qty: need,
      recipe: r.id,
      crafts,
      children: r.materials.map((m) => walk(m.id, m.qty * crafts, next, depth + 1)),
    };
  };
  return walk(id, Math.max(1, Math.floor(qty)), new Set(), 0);
}

/** soma as folhas da árvore: a lista de materiais brutos, por id */
export function rawMaterials(tree: TreeNode): Record<string, number> {
  const out: Record<string, number> = {};
  const visit = (n: TreeNode, root: boolean) => {
    if (!n.children.length && !root) out[n.id] = (out[n.id] ?? 0) + n.qty;
    n.children.forEach((c) => visit(c, false));
  };
  visit(tree, true);
  return out;
}
