#!/usr/bin/env node
/**
 * Importa ícones e nomes oficiais em português das skills a partir do MetaBot.GG.
 *
 * Para cada classe publicada em src/content/classes/*.json:
 *  - baixa https://metabot.gg/en/aion-2/classes/<classe>/build e a versão pt_BR;
 *  - lê o payload do Next.js (self.__next_f.push) e extrai {id, name, icon, kind};
 *  - casa en↔pt pelo id da skill (nunca pela posição);
 *  - casa com as nossas entradas (actives, passives, stigmas) pelo nome em inglês;
 *  - grava só os campos `icon` (URL estática https://metabot.gg/web/aion2/skills/<id>.webp)
 *    e `namePt`. Todo o resto do JSON fica igual.
 *
 * Fonte: MetaBot.GG (permite uso por IA; pede link dofollow para a página usada,
 * que as páginas de classe já têm). Nunca usa caminhos /api/ (bloqueados no robots.txt).
 *
 * Uso: npm run import:skills [-- --check] [-- templar ranger]
 *   --check  confere cada URL de ícone (HEAD/GET) e remove o `icon` das que não respondem 200.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'src', 'content', 'classes');
const UA = 'Mozilla/5.0 (compatible; RotaDaevaFanSite/1.0; +skill icon import)';
const ICON_BASE = 'https://metabot.gg/web/aion2/skills/';
/** nosso slug → slug no MetaBot (iguais hoje; fica aqui para quando mudar) */
const SLUG = { spiritmaster: 'spiritmaster' };

const args = process.argv.slice(2);
const check = args.includes('--check');
const only = args.filter((a) => !a.startsWith('--'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' } });
  if (!res.ok) throw new Error(`${res.status} em ${url}`);
  return res.text();
}

/** junta os pedaços do payload RSC do Next.js num texto só */
function flight(html) {
  let s = '';
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let m;
  while ((m = re.exec(html))) s += JSON.parse(`"${m[1]}"`);
  return s;
}

/**
 * skills: id → { name, kind, iconId }  (iconId nulo quando o MetaBot não tem ícone)
 * specs:  id da especialização → texto (cita outras skills entre [colchetes])
 */
function parsePage(html) {
  const s = flight(html);
  const re = /\{"id":(\d+),"name":"((?:[^"\\]|\\.)*)","href":"[^"]*","icon":(null|"[^"]*"),"kind":"(\w+)"/g;
  const skills = new Map();
  let m;
  while ((m = re.exec(s))) {
    const src = m[3] === 'null' ? '' : decodeURIComponent(m[3]);
    const file = src.match(/\/web\/aion2\/skills\/(\d+)\.webp/);
    if (!skills.has(m[1])) skills.set(m[1], { name: JSON.parse(`"${m[2]}"`), kind: m[4], iconId: file ? file[1] : null });
  }
  const specs = new Map();
  const sre = /\{"id":(\d+),"unlock":\d+,"text":"((?:[^"\\]|\\.)*)"/g;
  while ((m = sre.exec(s))) specs.set(m[1], JSON.parse(`"${m[2]}"`));
  return { skills, specs };
}

const brackets = (t) => [...new Set([...t.matchAll(/\[([^\]]+)\]/g)].map((x) => x[1]))];

/**
 * Skills em cadeia (ex.: Discharge do Clérigo) não têm entrada própria no MetaBot,
 * só aparecem citadas no texto das especializações. Casa en↔pt pelo id da
 * especialização; quando o texto cita mais de uma skill, descarta as já conhecidas
 * e só aceita se sobrar exatamente uma de cada lado.
 */
function chainNames(en, pt) {
  const known = new Map([...en.skills].map(([id, v]) => [v.name, pt.skills.get(id)?.name]));
  const knownPt = new Set(known.values());
  const out = new Map();
  for (const [id, tEn] of en.specs) {
    const tPt = pt.specs.get(id);
    if (!tPt) continue;
    const a = brackets(tEn).filter((n) => !known.has(n));
    const b = brackets(tPt).filter((n) => !knownPt.has(n));
    if (a.length === 1 && b.length === 1 && !out.has(norm(a[0]))) out.set(norm(a[0]), b[0]);
  }
  return out;
}

async function iconOk(url) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    const type = res.headers.get('content-type') ?? '';
    await res.arrayBuffer();
    return res.status === 200 && type.startsWith('image/');
  } catch {
    return false;
  }
}

const files = (await readdir(DIR)).filter((f) => f.endsWith('.json'));
const report = [];

for (const file of files) {
  const slug = file.replace(/\.json$/, '');
  if (only.length && !only.includes(slug)) continue;
  const path = join(DIR, file);
  const raw = await readFile(path, 'utf8');
  const data = JSON.parse(raw);
  const entries = [...(data.actives ?? []), ...(data.passives ?? []), ...(data.stigmas ?? [])];
  if (data.status !== 'published' || entries.length === 0) continue;

  const mb = SLUG[slug] ?? slug;
  const enPage = parsePage(await fetchText(`https://metabot.gg/en/aion-2/classes/${mb}/build`));
  await sleep(1200);
  const ptPage = parsePage(await fetchText(`https://metabot.gg/pt_BR/aion-2/classes/${mb}/build`));
  await sleep(1200);
  const en = enPage.skills;
  const pt = ptPage.skills;
  const chain = chainNames(enPage, ptPage);

  const byName = new Map([...en].map(([id, v]) => [norm(v.name), id]));
  const unmatched = [];
  const chainOnly = [];
  const noIcon = [];
  const broken = [];
  let icons = 0;
  let names = 0;

  // Edição cirúrgica no texto: os arquivos têm formatação feita à mão (listas e
  // objetos numa linha só), então nada de reserializar o JSON inteiro.
  // Cada entrada começa com  "id": "...",\n  "name": "...",  e os campos novos
  // entram logo depois de name (substituindo valores antigos, se houver).
  let out = raw;
  for (const e of entries) {
    const id = byName.get(norm(e.name));
    const chainPt = id ? undefined : chain.get(norm(e.name));
    if (!id && !chainPt) {
      unmatched.push(e.name);
      continue;
    }
    if (chainPt) chainOnly.push(e.name);
    let icon;
    const iconId = id ? en.get(id).iconId : null;
    if (id && !iconId) noIcon.push(e.name);
    if (iconId) {
      icon = `${ICON_BASE}${iconId}.webp`;
      if (check) {
        await sleep(250);
        if (!(await iconOk(icon))) {
          broken.push(`${e.name} (${icon})`);
          icon = undefined;
        }
      }
    }
    const namePt = id ? pt.get(id)?.name : chainPt;
    const re = new RegExp(
      `("id": ${esc(JSON.stringify(e.id))},)(\\r?\\n)([ \\t]*)("name": ${esc(JSON.stringify(e.name))},)` +
        `(?:\\r?\\n[ \\t]*"namePt": "(?:[^"\\\\]|\\\\.)*",)?(?:\\r?\\n[ \\t]*"icon": "(?:[^"\\\\]|\\\\.)*",)?`,
      'g',
    );
    const hits = out.match(re)?.length ?? 0;
    if (hits !== 1) {
      unmatched.push(`${e.name} (entrada não localizada no texto: ${hits})`);
      continue;
    }
    out = out.replace(re, (_, idLine, nl, ind, nameLine) =>
      idLine + nl + ind + nameLine +
      (namePt ? `${nl}${ind}"namePt": ${JSON.stringify(namePt)},` : '') +
      (icon ? `${nl}${ind}"icon": ${JSON.stringify(icon)},` : ''));
    if (icon) icons++;
    if (namePt) names++;
  }

  JSON.parse(out); // nunca grava JSON quebrado
  if (out !== raw) await writeFile(path, out, 'utf8');
  report.push({ slug, total: entries.length, icons, names, unmatched, broken });
  console.log(`${slug}: ${icons}/${entries.length} ícones, ${names}/${entries.length} nomes PT` +
    (unmatched.length ? ` | sem par: ${unmatched.join(', ')}` : '') +
    (chainOnly.length ? ` | skill em cadeia (só nome PT, sem ícone): ${chainOnly.join(', ')}` : '') +
    (noIcon.length ? ` | MetaBot sem ícone: ${noIcon.join(', ')}` : '') +
    (broken.length ? ` | ícones quebrados: ${broken.join(', ')}` : ''));
}

if (report.some((r) => r.unmatched.length || r.broken.length)) process.exitCode = 1;
