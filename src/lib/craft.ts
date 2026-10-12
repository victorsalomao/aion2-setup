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
