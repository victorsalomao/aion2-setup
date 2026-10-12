/**
 * Importa o banco de receitas de craft da MetaBot.GG para src/data/crafting.json,
 * com id, ícone e nome em português e inglês de cada item, e junta a faixa de
 * sucesso publicada pelo Shugo.GG.
 *
 *   npm run import:crafting
 *   node scripts/import-metabot-crafting.mjs en.html pt.html shugo.html   (lê HTML já baixado)
 *
 * Por que a MetaBot é a fonte principal: a calculadora em
 * https://metabot.gg/en/aion-2/crafting traz, no payload do Next.js
 * (scripts `self.__next_f.push([1,"..."])`), as 512 receitas do cliente com o id
 * de cada item, o arquivo do ícone, a chance de combo e a curva de sucesso por
 * maestria. A versão https://metabot.gg/pt_BR/aion-2/crafting traz as mesmas
 * receitas, com os mesmos ids, e os nomes oficiais em português. Os nomes se
 * casam pelo id do item, nunca pelo texto.
 *
 * O Shugo.GG (https://shugo.gg/crafting) continua como fonte da faixa de sucesso
 * (chance na maestria exata e teto). O script confere essa faixa com as pontas da
 * curva da MetaBot e avisa se discordarem; receita sem par no Shugo usa a curva.
 *
 * Nenhum dos dois sites tem o item consumido pelas evoluções Dragon Lord na lista
 * de materiais (ele não está na receita do cliente). O menu Dragon Lord
 * (src/data/dragon-lord.json) acrescenta essa peça a partir do guia de crafting
 * da MetaBot.
 *
 * Regras das fontes: nada de caminho /api/ (proibido no robots.txt das duas).
 * Os ícones são os arquivos estáticos em https://metabot.gg/web/aion2/items/.
 * A MetaBot pede link dofollow para a página usada; o Shugo, crédito com link.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseCrafting as parseShugo } from './import-shugo-crafting.mjs';

export const SOURCES = {
  en: 'https://metabot.gg/en/aion-2/crafting',
  pt: 'https://metabot.gg/pt_BR/aion-2/crafting',
  shugo: 'https://shugo.gg/crafting',
};
export const ICON_BASE = 'https://metabot.gg/web/aion2/items/';
const OUT = fileURLToPath(new URL('../src/data/crafting.json', import.meta.url));
const UA = 'RotaDaeva/0.1 (fan site; crafting import)';

/** ordem e id das profissões; o nome vem da própria página em cada idioma */
const PROFESSION_IDS = ['blacksmithing', 'armorsmithing', 'handicrafting', 'alchemy', 'cooking'];

/* ---------- payload do Next.js ---------- */

/** junta os pedaços de texto empurrados por `self.__next_f.push([1, "..."])` */
export function flightText(html) {
  const re = /self\.__next_f\.push\((\[[\s\S]*?\])\)\s*<\/script>/g;
  let out = '';
  let m;
  let n = 0;
  while ((m = re.exec(html))) {
    let arr;
    try { arr = JSON.parse(m[1]); } catch { continue; }
    if (arr[0] === 1 && typeof arr[1] === 'string') { out += arr[1]; n++; }
  }
  if (!n) throw new Error('nenhum pedaço self.__next_f.push([1, ...]) encontrado');
  return out;
}

/** recorta o objeto ou a lista JSON que começa em `start`, respeitando strings */
function balanced(s, start) {
  let depth = 0;
  let inStr = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  throw new Error(`JSON sem fechamento a partir de ${start}`);
}

/**
 * Acha as props da calculadora: o objeto que tem "recipes":[...] e "items":{...}.
 * Procura o "{" que abre o objeto dono da chave "recipes" (o primeiro "{" à
 * esquerda no mesmo nível) e confere o formato antes de devolver.
 */
export function calculatorProps(text) {
  let at = text.indexOf('"recipes":[{');
  while (at >= 0) {
    // sobe até o "{" que contém a chave
    let depth = 0;
    let i = at - 1;
    for (; i >= 0; i--) {
      const c = text[i];
      if (c === '}' || c === ']') depth++;
      else if (c === '{' || c === '[') { if (depth === 0) break; depth--; }
    }
    if (i >= 0 && text[i] === '{') {
      try {
        const obj = JSON.parse(balanced(text, i));
        if (Array.isArray(obj.recipes) && obj.items && typeof obj.items === 'object') return obj;
      } catch { /* tenta a próxima ocorrência */ }
    }
    at = text.indexOf('"recipes":[{', at + 1);
  }
  throw new Error('props da calculadora ("recipes" + "items") não encontradas no payload');
}

/* ---------- montagem ---------- */

/** 2º dígito do id da receita: 1 = Elyos, 2 = Asmodiano (256 de cada no cliente) */
export function factionOf(recipeId) {
  const d = String(recipeId)[1];
  if (d === '1') return 'elyos';
  if (d === '2') return 'asmodian';
  throw new Error(`id de receita sem facção reconhecível: ${recipeId}`);
}
/** id da receita irmã na outra facção */
const twinId = (id) => {
  const s = String(id);
  return Number(s[0] + (s[1] === '1' ? '2' : '1') + s.slice(2));
};

/** nome que o combo produz: "Artisan's X" -> "Artisan's Splendent X"; "X" -> "Splendent X" */
export function splendentName(name) {
  const m = name.match(/^((?:Artisan|Expert|Novice|Master)'s )(.+)$/);
  return m ? `${m[1]}Splendent ${m[2]}` : `Splendent ${name}`;
}

const r1 = (n) => Math.round(n * 10) / 10;
const sortedMats = (mats) => mats.map((m) => `${m.name}×${m.qty}`).sort().join('|');

export function buildDatabase(en, pt, shugo) {
  const ptRecipes = new Map(pt.recipes.map((r) => [r.id, r]));
  if (en.recipes.length !== pt.recipes.length) throw new Error(`en tem ${en.recipes.length} receitas e pt ${pt.recipes.length}`);

  /* itens: nome nos dois idiomas casado pelo id */
  const used = new Set();
  for (const r of en.recipes) { used.add(r.product); r.parts.forEach(([id]) => used.add(id)); }
  const items = {};
  const missingPt = [];
  for (const id of [...used].sort((a, b) => a - b)) {
    const e = en.items[id];
    if (!e) throw new Error(`item ${id} usado numa receita e ausente do mapa de itens`);
    const p = pt.items[id];
    if (!p?.name) missingPt.push(id);
    const icon = e.icon?.match(/^\/web\/aion2\/items\/([\w.-]+\.webp)$/)?.[1];
    if (!icon) throw new Error(`ícone fora do padrão em ${id}: ${e.icon}`);
    const slug = e.href?.match(/^\/aion-2\/items\/([\w-]+)$/)?.[1] ?? null;
    items[id] = { en: e.name, pt: p?.name ?? e.name, icon, grade: e.grade, slug, ...(en.gather?.[id] ? { gather: true } : {}) };
  }
  /* nome em inglês -> ids; o mesmo nome pode ter um id por facção */
  const byEnName = new Map();
  for (const [id, it] of Object.entries(items)) byEnName.set(it.en, [...(byEnName.get(it.en) ?? []), Number(id)]);
  /* facções das receitas que citam cada item (como produto ou material) */
  const itemFactions = new Map();
  for (const r of en.recipes) for (const id of [r.product, ...r.parts.map(([i]) => i)]) {
    itemFactions.set(id, (itemFactions.get(id) ?? new Set()).add(factionOf(r.id)));
  }
  /** o resultado do combo é o item Splendent de mesmo nome usado pela mesma facção */
  const comboResultOf = (productId, recipeId) => {
    const ids = byEnName.get(splendentName(items[productId].en)) ?? [];
    const f = factionOf(recipeId);
    return ids.find((id) => itemFactions.get(id)?.has(f)) ?? (ids.length === 1 ? ids[0] : undefined);
  };

  /* nome da profissão: inglês da página en, português da página pt (mesma receita) */
  const profNames = {};
  for (const r of en.recipes) {
    const id = r.category.toLowerCase();
    if (!PROFESSION_IDS.includes(id)) throw new Error(`profissão desconhecida: ${r.category}`);
    profNames[id] ??= { pt: ptRecipes.get(r.id)?.category ?? r.category, en: r.category };
  }

  /*
   * receitas: mesma receita nas duas facções (mesmo produto e mesmos materiais,
   * pelo id) vira uma linha "both". Várias receitas têm o mesmo nome nos dois
   * lados mas itens diferentes (ex.: Expert's Splendent Orichalcum Longsword é
   * 110240012 no Elyos e 110240014 no Asmodiano); essas ficam em duas linhas,
   * porque a árvore de materiais anda pelo id.
   */
  const byId = new Map(en.recipes.map((r) => [r.id, r]));
  const same = (a, b) => b && a.product === b.product && a.qty === b.qty && a.mastery === b.mastery
    && JSON.stringify(a.parts) === JSON.stringify(b.parts);
  const curve = (key) => (key && en.curves?.[key]) || null;
  const rows = [];
  const done = new Set();
  for (const r of [...en.recipes].sort((a, b) => a.id - b.id)) {
    if (done.has(r.id)) continue;
    done.add(r.id);
    let faction = factionOf(r.id);
    const twin = byId.get(twinId(r.id));
    if (same(r, twin)) { done.add(twin.id); faction = 'both'; }
    const c = curve(r.rate?.[0]);
    const combo = Number(r.combo) || 0;
    // poção, comida e Manastone também têm combo, mas o resultado não é um item
    // "Splendent" da lista; nesses casos fica só a chance
    const comboId = combo ? comboResultOf(r.product, r.id) : undefined;
    rows.push({
      id: r.id,
      profession: r.category.toLowerCase(),
      product: r.product,
      qty: r.qty,
      mastery: r.mastery,
      success: c ? { min: r1(c[0]), max: r1(c[c.length - 1]) } : null,
      combo,
      ...(comboId ? { comboResult: comboId } : {}),
      materials: r.parts.map(([id, qty]) => ({ id, qty })),
      faction,
    });
  }

  /* faixa de sucesso do Shugo.GG, casada por nome em inglês + quantidade + maestria + materiais + facção */
  const shugoStats = { matched: 0, unmatched: [], disagree: [] };
  if (shugo) {
    const key = (name, qty, mastery, mats, faction) => `${name}#${qty}#${mastery}#${faction}#${sortedMats(mats)}`;
    const pool = new Map();
    for (const p of shugo.professions) for (const s of p.recipes) {
      const k = key(s.product, s.qty, s.mastery, s.materials, s.faction);
      if (!pool.has(k)) pool.set(k, s);
    }
    for (const row of rows) {
      const mats = row.materials.map((m) => ({ name: items[m.id].en, qty: m.qty }));
      // o Shugo junta numa linha "both" o par com nomes iguais; na MetaBot o par
      // pode ter ids diferentes (item da facção) e continua em duas linhas
      const s = pool.get(key(items[row.product].en, row.qty, row.mastery, mats, row.faction))
        ?? pool.get(key(items[row.product].en, row.qty, row.mastery, mats, 'both'));
      if (!s) { shugoStats.unmatched.push(row.id); continue; }
      shugoStats.matched++;
      if (s.success) {
        if (row.success && (Math.abs(row.success.min - s.success.min) > 0.15 || Math.abs(row.success.max - s.success.max) > 0.15)) {
          shugoStats.disagree.push(`${items[row.product].en}: MetaBot ${row.success.min}–${row.success.max}, Shugo ${s.success.min}–${s.success.max}`);
        }
        row.success = { min: s.success.min, max: s.success.max };
      }
    }
  }

  /* ordem: por profissão; dentro dela pela maestria da família (evolução junto da receita base) e pelo id */
  const famMastery = new Map();
  for (const r of rows) if (r.mastery > 0) {
    const fam = Math.floor(r.id / 100);
    famMastery.set(fam, Math.min(famMastery.get(fam) ?? Infinity, r.mastery));
  }
  const eff = (r) => r.mastery || famMastery.get(Math.floor(r.id / 100)) || 100;
  const professions = PROFESSION_IDS.filter((id) => profNames[id]).map((id) => ({
    id,
    name: profNames[id],
    recipes: rows.filter((r) => r.profession === id)
      .sort((a, b) => eff(a) - eff(b) || a.id - b.id)
      .map(({ profession, ...r }) => r),
  }));

  return { items, professions, missingPt, shugoStats, rawCount: en.recipes.length };
}

async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`${url} respondeu ${res.status}`);
  return res.text();
}

async function main() {
  const [enFile, ptFile, shugoFile] = process.argv.slice(2);
  // uma página por vez, sem pressa
  const enHtml = enFile ? await readFile(enFile, 'utf8') : await get(SOURCES.en);
  const ptHtml = ptFile ? await readFile(ptFile, 'utf8') : await get(SOURCES.pt);
  const shugoHtml = shugoFile ? await readFile(shugoFile, 'utf8') : await get(SOURCES.shugo).catch((err) => {
    console.warn(`aviso: Shugo.GG indisponível (${err.message}); faixa de sucesso sai da curva da MetaBot`);
    return null;
  });

  const en = calculatorProps(flightText(enHtml));
  const pt = calculatorProps(flightText(ptHtml));
  const shugo = shugoHtml ? parseShugo(shugoHtml) : null;
  const db = buildDatabase(en, pt, shugo);

  const data = {
    checkedAt: new Date().toISOString().slice(0, 10),
    sources: {
      metabot: { credit: 'MetaBot.GG', url: SOURCES.en, urlPt: SOURCES.pt },
      shugo: shugo ? { credit: 'Shugo.GG', url: SOURCES.shugo, dataAsOf: shugo.asOf } : null,
    },
    iconBase: ICON_BASE,
    items: db.items,
    professions: db.professions,
  };
  await writeFile(OUT, JSON.stringify(data, null, 1) + '\n', 'utf8');

  for (const p of db.professions) console.log(`${p.name.en.padEnd(14)} ${p.name.pt.padEnd(12)} ${String(p.recipes.length).padStart(4)} receitas`);
  const total = db.professions.reduce((n, p) => n + p.recipes.length, 0);
  console.log(`total: ${total} receitas (${db.rawCount} no cliente, pares idênticos juntados), ${Object.keys(db.items).length} itens -> ${OUT}`);
  console.log(`itens sem nome em português: ${db.missingPt.length}${db.missingPt.length ? ` (${db.missingPt.join(', ')})` : ''}`);
  if (shugo) {
    console.log(`Shugo.GG: ${db.shugoStats.matched} receitas casadas, ${db.shugoStats.unmatched.length} sem par`);
    if (db.shugoStats.unmatched.length) console.log(`  sem par: ${db.shugoStats.unmatched.join(', ')}`);
    db.shugoStats.disagree.forEach((d) => console.warn(`  faixa diferente: ${d}`));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
