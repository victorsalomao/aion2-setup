/**
 * Contas do menu de craft. Funções puras: recebem receitas e quantidades,
 * devolvem totais. A tela só chama estas funções e desenha o resultado.
 */
export interface MaterialRef {
  id: string;
  qty: number;
}

export interface PlanLine {
  materials: MaterialRef[];
  /** quantas vezes a receita será fabricada */
  count: number;
}

/** soma os materiais de várias receitas, multiplicando pela quantidade de cada uma */
export function aggregate(lines: PlanLine[]): Record<string, number> {
  const total: Record<string, number> = {};
  for (const line of lines) {
    const times = Math.max(0, Math.floor(line.count));
    if (!times) continue;
    for (const m of line.materials) {
      total[m.id] = (total[m.id] ?? 0) + m.qty * times;
    }
  }
  return total;
}

/** quanto falta de cada material, já descontando o que você tem */
export function shortfall(need: Record<string, number>, have: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, qty] of Object.entries(need)) {
    const missing = qty - Math.max(0, have[id] ?? 0);
    if (missing > 0) out[id] = missing;
  }
  return out;
}

/** fração de 0 a 1 do que já foi juntado */
export function progress(need: number, have: number): number {
  if (need <= 0) return 1;
  return Math.min(1, Math.max(0, have) / need);
}

/**
 * Tentativas esperadas até sair um combo (Splendent) com chance p por fabricação.
 * Distribuição geométrica: média 1/p.
 */
export function expectedCrafts(chance: number): number {
  return chance > 0 ? 1 / chance : Infinity;
}

/** um degrau de uma escada de craft (ex.: Artisan's Splendent -> True -> ... -> Splendent Wise) */
export interface ChainStep {
  /** id do item que este passo entrega */
  item: string;
  /**
   * materiais de uma fabricação. Um material que é o item de outro passo (a peça
   * consumida pela evolução, a Artisan's Splendent) vira demanda daquele passo;
   * o resto é material bruto da lista de compras.
   */
  materials: MaterialRef[];
  /** o item só sai no combo desta receita: precisa de 1/chance fabricações em média */
  viaCombo?: boolean;
}

export interface ChainLine {
  /** posição do passo na escada */
  index: number;
  item: string;
  /** quantas unidades do item este passo precisa entregar */
  need: number;
  /** fabricações (média, se average) */
  crafts: number;
  /** true quando crafts é uma média (passo que depende do combo) */
  average: boolean;
  /** materiais brutos desta linha, já multiplicados pelas fabricações */
  materials: MaterialRef[];
  /** itens de outros passos que esta linha consome */
  consumes: MaterialRef[];
}

export interface ChainOptions {
  /** chance de combo por fabricação (padrão 0,25) */
  comboChance?: number;
  /** quantas peças do degrau final (padrão 1) */
  count?: number;
  /** peças que você já tem, por id: descontam a demanda do passo antes de abrir a receita */
  owned?: Record<string, number>;
}

/**
 * Abre a escada do zero até o passo `target`, de trás para a frente.
 * Cada passo só depende de passos anteriores, então uma passada do fim para o
 * começo resolve: a demanda de cada passo vira fabricações, e as fabricações
 * viram materiais brutos ou demanda de um passo anterior.
 * Fabricação normal conta como sucesso; só o combo do passo viaCombo entra como
 * média (1/chance). Devolve as linhas na ordem de fabricar e o total bruto.
 */
export function expandChain(steps: ChainStep[], target: number, opts: ChainOptions = {}): { lines: ChainLine[]; total: Record<string, number> } {
  const chance = opts.comboChance ?? 0.25;
  const owned = opts.owned ?? {};
  const last = Math.min(Math.max(0, Math.floor(target)), steps.length - 1);
  const indexOf = new Map(steps.map((s, i) => [s.item, i]));
  const need = steps.map(() => 0);
  need[last] = Math.max(0, opts.count ?? 1);
  const lines: ChainLine[] = [];
  const total: Record<string, number> = {};

  for (let i = last; i >= 0; i--) {
    const s = steps[i];
    const want = Math.max(0, need[i] - Math.max(0, owned[s.item] ?? 0));
    if (want <= 0) continue;
    const average = !!s.viaCombo;
    const crafts = average ? want * expectedCrafts(chance) : want;
    const materials: MaterialRef[] = [];
    const consumes: MaterialRef[] = [];
    for (const m of s.materials) {
      const qty = m.qty * crafts;
      const j = indexOf.get(m.id);
      if (j !== undefined && j < i) {
        need[j] += qty;
        consumes.push({ id: m.id, qty });
      } else {
        materials.push({ id: m.id, qty });
        total[m.id] = (total[m.id] ?? 0) + qty;
      }
    }
    lines.push({ index: i, item: s.item, need: want, crafts, average, materials, consumes });
  }
  return { lines: lines.reverse(), total };
}
