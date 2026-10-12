/**
 * Monta src/data/dragon-lord.json a partir de src/data/crafting.json (MetaBot.GG).
 * Não baixa nada: roda depois de `import-metabot-crafting.mjs` (npm run import:crafting
 * chama os dois).
 *
 * Para cada peça Dragon Lord do cliente (armas, guarda, sete espaços de armadura,
 * colar, brinco e anel) sai a escada inteira, nas duas facções:
 *
 *   0 Artisan's Splendent (44)  combo de 25% ao fabricar a versão Artisan's
 *   1 True / Star (62)          maestria 55 ou 60, consome 1 Artisan's Splendent
 *   2 Splendent True (70)       combo do passo 1 ou evolução: consome o True
 *   3 White / Dark (78)         evolução: consome o Splendent True + 1 Artisan's Splendent
 *   4 Splendent White (86)      combo do passo 3 ou evolução: consome o White
 *   5 Wise / Ebony (94)         evolução: consome o Splendent White + 1 Artisan's Splendent
 *   6 Splendent Wise (102)      combo do passo 5 ou evolução: consome o Wise
 *
 * A receita do cliente (e portanto a da MetaBot e a do Shugo) não lista a peça
 * consumida pela evolução. Ela entra aqui como material marcado com "prev": true,
 * conforme o guia de crafting da MetaBot.GG:
 * https://metabot.gg/en/aion-2/guides/crafting-guide
 * O mesmo guia dá os níveis de item (44 a 102); o cliente não traz esse número.
 *
 *   node scripts/build-dragon-lord.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const IN = fileURLToPath(new URL('../src/data/crafting.json', import.meta.url));
const OUT = fileURLToPath(new URL('../src/data/dragon-lord.json', import.meta.url));

export const GUIDE = {
  en: 'https://metabot.gg/en/aion-2/guides/crafting-guide',
  pt: 'https://metabot.gg/pt_BR/aion-2/guides/crafting-guide',
};

/** degraus: nome em cada facção (casado pelo nome em inglês) e nível de item do guia */
export const TIERS = [
  { key: 'artisan', itemLevel: 44 },
  { key: 'true', itemLevel: 62, elyos: 'True Dragon Lord', asmodian: 'Star Dragon Lord' },
  { key: 'splendent-true', itemLevel: 70, elyos: 'Splendent True Dragon Lord', asmodian: 'Splendent Star Dragon Lord' },
  { key: 'white', itemLevel: 78, elyos: 'White Dragon Lord', asmodian: 'Dark Dragon Lord' },
  { key: 'splendent-white', itemLevel: 86, elyos: 'Splendent White Dragon Lord', asmodian: 'Splendent Dark Dragon Lord' },
  { key: 'wise', itemLevel: 94, elyos: 'Wise Dragon Lord', asmodian: 'Ebony Dragon Lord' },
  { key: 'splendent-wise', itemLevel: 102, elyos: 'Splendent Wise Dragon Lord', asmodian: 'Splendent Ebony Dragon Lord' },
];

/** ordem e grupo das peças; o tipo vem do nome em inglês do True Dragon Lord */
const PIECES = [
  ['longsword', 'weapon', 'Longsword'], ['greatsword', 'weapon', 'Greatsword'], ['dagger', 'weapon', 'Dagger'],
  ['mace', 'weapon', 'Mace'], ['bow', 'weapon', 'Bow'], ['staff', 'weapon', 'Staff'],
  ['spellbook', 'weapon', 'Spellbook'], ['orb', 'weapon', 'Orb'], ['guard', 'weapon', 'Guard'],
  ['breastplate', 'armor', 'Breastplate'], ['greaves', 'armor', 'Greaves'], ['helm', 'armor', 'Helm'],
  ['pauldrons', 'armor', 'Pauldrons'], ['gloves', 'armor', 'Gloves'], ['boots', 'armor', 'Boots'], ['cloak', 'armor', 'Cloak'],
  ['necklace', 'accessory', 'Necklace'], ['earrings', 'accessory', 'Earrings'], ['ring', 'accessory', 'Ring'],
];

/** origem dos materiais de masmorra, segundo o guia de crafting da MetaBot.GG */
const DUNGEON = {
  pt: 'Material de masmorra: masmorras de grupo (como a Krao Cave) e a raide Ludra. Não cai no campo.',
  en: 'Dungeon material: party dungeons such as Krao Cave and the Ludra raid. Does not drop in the field.',
};
const HAND_SOURCES = {
  "Artisan's Ultimate Refining Stone": DUNGEON,
  'Wrathful Mind': DUNGEON,
  'Wrathful Will': DUNGEON,
  'Wrathful Ego': DUNGEON,
  "Artisan's Refining Stone": {
    pt: 'Drop de monstros do campo.',
    en: 'Field monster drop.',
  },
  "Balaur's Essence": {
    pt: 'Masmorras de grupo, a raide Ludra e alguns monstros do campo.',
    en: 'Party dungeons, the Ludra raid and some field monsters.',
  },
};

export function buildDragonLord(db) {
  const profs = db.professions;
  const rows = profs.flatMap((p) => p.recipes.map((r) => ({ ...r, profession: p.id })));
  const items = db.items;
  const profName = Object.fromEntries(profs.map((p) => [p.id, p.name]));
  const fits = (r, f) => r.faction === f || r.faction === 'both';
  const byName = (en) => Object.keys(items).filter((id) => items[id].en === en).map(Number);
  /** receita da facção que fabrica o item com este nome em inglês */
  const recipeNamed = (en, f) => {
    const ids = byName(en);
    const found = rows.filter((r) => ids.includes(r.product) && fits(r, f));
    if (found.length !== 1) throw new Error(`esperava 1 receita para "${en}" (${f}), achei ${found.length}`);
    return found[0];
  };

  const used = new Set();
  const ref = (id, qty, extra = {}) => { used.add(id); return { id: String(id), qty, ...extra }; };
  const missing = [];

  const pieces = [];
  for (const [slot, group, type] of PIECES) {
    let trueRecipe;
    try { trueRecipe = { elyos: recipeNamed(`True Dragon Lord ${type}`, 'elyos'), asmodian: recipeNamed(`Star Dragon Lord ${type}`, 'asmodian') }; }
    catch (err) { missing.push(`${type}: ${err.message}`); continue; }

    const steps = TIERS.map((t) => ({ tier: t.key, itemLevel: t.itemLevel }));
    for (const f of ['elyos', 'asmodian']) {
      /* passo 0: a peça Artisan's Splendent que o True pede, e a receita Artisan's que dá ela no combo */
      const tr = trueRecipe[f];
      const baseMat = tr.materials.find((m) => /^Artisan's Splendent /.test(items[m.id].en));
      if (!baseMat) throw new Error(`${type} ${f}: receita True sem Artisan's Splendent`);
      const artisan = rows.filter((r) => r.comboResult === baseMat.id && fits(r, f));
      if (artisan.length !== 1) throw new Error(`${type} ${f}: esperava 1 receita Artisan's para ${items[baseMat.id].en}, achei ${artisan.length}`);
      const a = artisan[0];
      Object.assign(steps[0], { mastery: a.mastery, upgrade: false, viaCombo: true, combo: a.combo, success: a.success });
      steps[0][f] = { item: String(baseMat.id), craft: String(a.product), recipe: a.id, materials: a.materials.map((m) => ref(m.id, m.qty)) };
      used.add(baseMat.id); used.add(a.product);

      /* passos 1 a 6 */
      let prev = null;
      TIERS.slice(1).forEach((t, k) => {
        const i = k + 1;
        const r = recipeNamed(`${t[f]} ${type}`, f);
        const upgrade = r.mastery === 0;
        if ((i === 1) === upgrade) throw new Error(`${type} ${f} ${t.key}: maestria ${r.mastery} fora do esperado`);
        Object.assign(steps[i], {
          mastery: upgrade ? null : r.mastery, upgrade, combo: r.combo, success: r.success,
          // os degraus Splendent também saem no combo do degrau anterior
          ...(t.key.startsWith('splendent-') ? { alsoCombo: steps[i - 1].combo ?? 25 } : {}),
        });
        const mats = r.materials.map((m) => ref(m.id, m.qty));
        if (upgrade) mats.unshift(ref(prev, 1, { prev: true }));
        steps[i][f] = { item: String(r.product), recipe: r.id, materials: mats };
        used.add(r.product);
        prev = r.product;
      });
    }

    const trueItem = items[trueRecipe.elyos.product];
    const typeName = {
      en: type,
      // "Cajado do Lorde Dragão Verdadeiro" -> "Cajado"
      pt: trueItem.pt.replace(/\s+d[oa]s?\s+Lorde Drag[aã]o.*$/i, '').trim(),
    };
    const prof = trueRecipe.elyos.profession;
    pieces.push({
      slot, group, name: typeName,
      profession: { id: prof, ...profName[prof] },
      unlock: trueRecipe.elyos.mastery,
      steps,
    });
  }

  /* itens: nome nos dois idiomas, ícone, página e origem */
  const recipeFor = (id) => rows.filter((r) => r.product === id).sort((x, y) => (x.mastery || 999) - (y.mastery || 999))[0];
  const list = (r, lang) => r.materials.map((m) => `${m.qty}× ${items[m.id][lang]}`).join(', ');
  // só os materiais comprados ou juntados precisam da linha de origem
  const asMaterial = new Set(pieces.flatMap((p) => p.steps.flatMap((s) => [s.elyos, s.asmodian]
    .flatMap((v) => v.materials.filter((m) => !m.prev).map((m) => Number(m.id))))));
  const out = {};
  for (const id of [...used].sort((x, y) => x - y)) {
    const it = items[id];
    if (!asMaterial.has(id)) { out[id] = { name: { pt: it.pt, en: it.en }, icon: it.icon, slug: it.slug ?? null, source: null }; continue; }
    let source = HAND_SOURCES[it.en] ?? null;
    const r = recipeFor(id);
    const combo = rows.find((x) => x.comboResult === id && x.mastery > 0);
    if (!source && r && r.mastery > 0 && !/Dragon Lord/.test(it.en)) {
      const p = profName[r.profession];
      source = {
        pt: `Fabricado em ${p.pt} (maestria ${r.mastery}): ${list(r, 'pt')}${r.qty > 1 ? ` (rende ${r.qty})` : ''}.`,
        en: `Crafted with ${p.en} (mastery ${r.mastery}): ${list(r, 'en')}${r.qty > 1 ? ` (makes ${r.qty})` : ''}.`,
      };
    } else if (!source && combo && !/Dragon Lord|^Artisan's Splendent/.test(it.en)) {
      source = {
        pt: `Sai no combo (${combo.combo}%) ao fabricar ${items[combo.product].pt} (maestria ${combo.mastery}).`,
        en: `Comes from the combo (${combo.combo}%) when crafting ${items[combo.product].en} (mastery ${combo.mastery}).`,
      };
    } else if (!source && it.gather) {
      source = { pt: 'Coleta: Extração de Essência.', en: 'Gathered with Essence Extraction.' };
    }
    out[id] = { name: { pt: it.pt, en: it.en }, icon: it.icon, slug: it.slug ?? null, source };
  }

  return { pieces, items: out, missing };
}

async function main() {
  const db = JSON.parse(await readFile(IN, 'utf8'));
  const { pieces, items, missing } = buildDragonLord(db);
  const data = {
    checkedAt: db.checkedAt,
    sources: {
      crafting: { en: db.sources.metabot.url, pt: db.sources.metabot.urlPt },
      guide: GUIDE,
      shugo: db.sources.shugo?.url ?? null,
    },
    iconBase: db.iconBase,
    comboChance: 0.25,
    items,
    pieces,
  };
  await writeFile(OUT, JSON.stringify(data, null, 1) + '\n', 'utf8');
  const by = (g) => pieces.filter((p) => p.group === g).map((p) => p.slot).join(', ');
  console.log(`armas: ${by('weapon')}\narmadura: ${by('armor')}\nacessórios: ${by('accessory')}`);
  console.log(`${pieces.length} peças × ${TIERS.length} passos, ${Object.keys(items).length} itens -> ${OUT}`);
  if (missing.length) console.warn(`sem receita no cliente:\n  ${missing.join('\n  ')}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
