/**
 * Simulação dia a dia da Energia Odyle até uma recompensa garantida.
 * Função pura: recebe números, devolve números. Não toca em DOM nem em estado,
 * por isso roda igual no navegador, no build e nos testes.
 */
export interface OdyleInput {
  /** energia básica agora */
  energy: number;
  /** itens pequenos, de 10 */
  small: number;
  /** itens grandes, de 40 */
  big: number;
  /** teto da energia básica (840 com assinatura, 560 sem) */
  cap: number;
  /** regeneração por dia */
  regen: number;
  /** custo de um cubo */
  cost: number;
  /** cubos que a recompensa pede */
  goal: number;
  /** cubos já abertos nessa contagem */
  done: number;
  /** energia reservada por dia para outra atividade (Transcendência) */
  reserve?: number;
  /** a reserva de hoje já foi gasta */
  reserveDoneToday?: boolean;
  /** limitar também pelo contador de entradas */
  limit?: boolean;
  /** cubos que o contador libera agora */
  count?: number;
  /** cubos que o contador devolve por dia */
  refill?: number;
}

export interface OdyleRow {
  day: number;
  opened: number;
  total: number;
  energyLeft: number;
  /** o que impediu de abrir mais nesse dia */
  limitedBy: '' | 'energy' | 'counter';
}

export interface OdylePlan {
  need: number;
  totalEnergy: number;
  stockCubes: number;
  /** energia que falta, olhando só o estoque de hoje */
  shortfall: number;
  /** dias até fechar; null se não fecha em MAX_DAYS */
  days: number | null;
  reserved: number;
  hitCounter: boolean;
  rows: OdyleRow[];
}

export const SMALL_ITEM = 10;
export const BIG_ITEM = 40;
const MAX_DAYS = 120;
const COUNTER_CAP = 21;

export function planOdyle(o: OdyleInput): OdylePlan {
  const need = Math.max(0, o.goal - o.done);
  let basic = Math.max(0, o.energy);
  let items = o.small * SMALL_ITEM + o.big * BIG_ITEM;
  const totalEnergy = basic + items;
  const stockCubes = Math.floor(totalEnergy / o.cost);
  const limited = !!o.limit;
  let count = limited ? Math.max(0, o.count ?? 0) : Infinity;
  const refill = Math.max(0, o.refill ?? 0);
  const reserve = Math.max(0, o.reserve ?? 0);

  const rows: OdyleRow[] = [];
  let left = need;
  let day = 0;
  let opened = 0;
  let reserved = 0;
  let hitCounter = false;

  while (left > 0 && day <= MAX_DAYS) {
    if (day > 0) {
      // a regeneração só enche a energia básica, e para no teto
      if (basic < o.cap) basic = Math.min(o.cap, basic + o.regen);
      if (limited) count = Math.min(COUNTER_CAP, count + refill);
    }
    // a reserva sai antes dos cubos
    const want = day === 0 && o.reserveDoneToday ? 0 : reserve;
    const fromBasicReserve = Math.min(want, basic);
    const fromItemsReserve = Math.min(want - fromBasicReserve, items);
    basic -= fromBasicReserve;
    items -= fromItemsReserve;
    reserved += fromBasicReserve + fromItemsReserve;

    const can = Math.min(Math.floor((basic + items) / o.cost), count, left);
    const spend = can * o.cost;
    const fromBasic = Math.min(spend, basic);
    basic -= fromBasic;
    items -= spend - fromBasic;

    const byCounter = can < left && can === count && basic + items >= o.cost;
    if (byCounter) hitCounter = true;
    count -= can;
    left -= can;
    opened += can;
    rows.push({
      day,
      opened: can,
      total: o.done + opened,
      energyLeft: basic + items,
      limitedBy: left > 0 ? (byCounter ? 'counter' : 'energy') : '',
    });
    if (left > 0) day++;
  }

  return {
    need,
    totalEnergy,
    stockCubes,
    shortfall: Math.max(0, need * o.cost - totalEnergy),
    days: left > 0 ? null : day,
    reserved,
    hitCounter,
    rows,
  };
}
