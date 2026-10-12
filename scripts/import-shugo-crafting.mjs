/**
 * Importa todas as receitas de craft do Shugo.GG para src/data/crafting.json.
 *
 *   npm run import:crafting
 *   node scripts/import-shugo-crafting.mjs pagina-salva.html   (lê um HTML já baixado)
 *
 * A página https://shugo.gg/crafting traz um bloco renderizado no servidor
 * (<section class="ssr-only" data-ssr="crafting">) com a lista completa:
 *
 *   <h2>Alchemy</h2>
 *   <ul>
 *     <li><strong>Produto</strong> ×3 (mastery 5, 95.2–99.2% success): Material ×1, Outro ×2</li>
 *   </ul>
 *
 * O Shugo pede crédito com link para a página. Não use nenhum caminho /api/
 * (proibido no robots.txt deles): este script só lê a página pública.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const SOURCE = 'https://shugo.gg/crafting';
const OUT = fileURLToPath(new URL('../src/data/crafting.json', import.meta.url));

/** nome da profissão no Shugo -> id e nomes nos dois idiomas */
const PROFESSIONS = {
  Blacksmithing: { id: 'blacksmithing', pt: 'Ferraria' },
  Armorsmithing: { id: 'armorsmithing', pt: 'Armoraria' },
  Handicrafting: { id: 'handicrafting', pt: 'Artesanato' },
  Alchemy: { id: 'alchemy', pt: 'Alquimia' },
  Cooking: { id: 'cooking', pt: 'Culinária' },
};

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, k) => ENTITIES[k.toLowerCase()] ?? m)
    .trim();
}

/** recorta o bloco SSR do craft; falha alto se a página mudar de formato */
export function ssrBlock(html) {
  const open = html.match(/<(section|div)\b[^>]*data-ssr="crafting"[^>]*>/);
  if (!open) throw new Error('bloco data-ssr="crafting" não encontrado');
  const start = open.index + open[0].length;
  const end = html.indexOf(`</${open[1]}>`, start);
  if (end < 0) throw new Error('bloco data-ssr="crafting" sem fechamento');
  return html.slice(start, end);
}

/** "Spiritstone ×2, Catalyst (Bound) ×1" -> [{ name, qty }] */
function parseMaterials(text) {
  // a separação é feita no "×N" final de cada material, não na vírgula,
  // porque um nome de item poderia ter vírgula
  const out = [];
  const re = /\s*(.+?)\s*×\s*(\d+)\s*(?:,|$)/y;
  let pos = 0;
  while (pos < text.length) {
    re.lastIndex = pos;
    const m = re.exec(text);
    if (!m) throw new Error(`material ilegível: ${text.slice(pos)}`);
    out.push({ name: m[1], qty: Number(m[2]) });
    pos = re.lastIndex;
  }
  return out;
}

const LI = /^<strong>(.*?)<\/strong>(?:\s*×\s*(\d+))?\s*\(([^)]*)\):\s*(.*)$/s;

/** uma linha <li> -> receita */
export function parseRecipe(inner) {
  const m = inner.trim().match(LI);
  if (!m) throw new Error(`receita fora do formato: ${inner}`);
  const [, product, qty, meta, mats] = m;
  const mastery = meta.match(/mastery\s+(\d+)/i);
  if (!mastery) throw new Error(`receita sem maestria: ${inner}`);
  const rate = meta.match(/([\d.]+)\s*[–-]\s*([\d.]+)%\s*success/i) ?? meta.match(/([\d.]+)%\s*success/i);
  const success = rate ? { min: Number(rate[1]), max: Number(rate[2] ?? rate[1]) } : null;
  const materials = parseMaterials(decode(mats.replace(/<[^>]+>/g, '')));
  return { product: decode(product.replace(/<[^>]+>/g, '')), qty: qty ? Number(qty) : 1, mastery: Number(mastery[1]), success, materials };
}

const slug = (s) => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** mesma receita nas duas facções: mesma maestria, quantidade e número de materiais */
const mirrors = (a, b) => b && a.mastery === b.mastery && a.qty === b.qty && a.materials.length === b.materials.length;

/**
 * A lista não marca a facção, mas vem em pares: cada receita Elyos seguida da
 * versão Asmodiana (Verteron Pepper / Altgard Pepper, True / Star Dragon Lord,
 * Yggdrasil / Asvata). Par idêntico vira uma linha só, com facção "both";
 * par diferente vira duas linhas, "elyos" e "asmodian".
 * Se a lista não fechar em pares, a facção fica "both" e só as linhas
 * idênticas são removidas.
 */
export function withFaction(rows, label = '') {
  const paired = rows.length % 2 === 0 && rows.every((r, i) => i % 2 === 1 || mirrors(r, rows[i + 1]));
  if (!paired) {
    console.warn(`aviso: ${label} não fecha em pares Elyos/Asmodiano; facção não marcada`);
    const seen = new Set();
    return rows.filter((r) => {
      const k = JSON.stringify(r);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).map((r) => ({ ...r, faction: 'both' }));
  }
  const out = [];
  for (let i = 0; i < rows.length; i += 2) {
    const [e, a] = [rows[i], rows[i + 1]];
    if (JSON.stringify(e) === JSON.stringify(a)) out.push({ ...e, faction: 'both' });
    else out.push({ ...e, faction: 'elyos' }, { ...a, faction: 'asmodian' });
  }
  return out;
}

export function parseCrafting(html) {
  const block = ssrBlock(html);
  const professions = [];
  // cada <h2> abre uma profissão; o <ul> logo depois tem as receitas
  const re = /<h2[^>]*>(.*?)<\/h2>\s*<ul[^>]*>(.*?)<\/ul>/gs;
  let m;
  while ((m = re.exec(block))) {
    const name = decode(m[1].replace(/<[^>]+>/g, ''));
    const known = PROFESSIONS[name];
    if (!known) throw new Error(`profissão desconhecida: ${name}`);
    const rows = [...m[2].matchAll(/<li[^>]*>(.*?)<\/li>/gs)].map((r) => parseRecipe(r[1]));
    const recipes = withFaction(rows, name).map((r) => ({ id: `${known.id}-${slug(r.product)}-x${r.qty}-m${r.mastery}-${r.faction[0]}`, ...r }));
    professions.push({ id: known.id, name: { pt: known.pt, en: name }, rawCount: rows.length, recipes });
  }
  if (!professions.length) throw new Error('nenhuma profissão encontrada no bloco SSR');
  const asOf = block.match(/Data as of (\d{4}-\d{2}-\d{2})/);
  return { professions, asOf: asOf?.[1] ?? null };
}

async function main() {
  const local = process.argv[2];
  let html;
  if (local) html = await readFile(local, 'utf8');
  else {
    const res = await fetch(SOURCE, { headers: { 'user-agent': 'RotaDaeva/0.1 (fan site; crafting import)' } });
    if (!res.ok) throw new Error(`${SOURCE} respondeu ${res.status}`);
    html = await res.text();
  }
  const { professions, asOf } = parseCrafting(html);
  const data = {
    checkedAt: new Date().toISOString().slice(0, 10),
    sourceDataAsOf: asOf,
    source: SOURCE,
    credit: 'Shugo.GG',
    professions: professions.map(({ rawCount, ...p }) => p),
  };
  await writeFile(OUT, JSON.stringify(data, null, 2) + '\n', 'utf8');
  for (const p of professions) console.log(`${p.name.en.padEnd(14)} ${String(p.recipes.length).padStart(4)} receitas (${p.rawCount} linhas na origem)`);
  console.log(`total: ${professions.reduce((n, p) => n + p.recipes.length, 0)} -> ${OUT}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
