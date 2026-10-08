import { describe, expect, it } from 'vitest';
import { planOdyle, type OdyleInput } from '../src/lib/odyle';

const base: OdyleInput = { energy: 0, small: 0, big: 0, cap: 840, regen: 120, cost: 40, goal: 21, done: 0 };

describe('planOdyle', () => {
  it('fecha hoje quando o estoque paga tudo', () => {
    const plan = planOdyle({ ...base, energy: 840 });
    expect(plan.days).toBe(0);
    expect(plan.shortfall).toBe(0);
    expect(plan.rows).toHaveLength(1);
  });

  it('caso real: 0 de energia, 10 itens de 40, 2 de 10, 8 de 21 abertos', () => {
    const plan = planOdyle({ ...base, big: 10, small: 2, done: 8 });
    expect(plan.need).toBe(13);
    expect(plan.totalEnergy).toBe(420);
    expect(plan.stockCubes).toBe(10);
    expect(plan.shortfall).toBe(100);
    expect(plan.days).toBe(1);
    expect(plan.rows.map((r) => r.opened)).toEqual([10, 3]);
  });

  it('a reserva diária atrasa o fechamento', () => {
    const plan = planOdyle({ ...base, big: 10, small: 2, done: 8, reserve: 40 });
    expect(plan.days).toBe(2);
    expect(plan.rows.map((r) => r.opened)).toEqual([9, 2, 2]);
    expect(plan.reserved).toBe(120);
  });

  it('o contador de entradas segura mesmo com energia sobrando', () => {
    const plan = planOdyle({ ...base, big: 10, small: 2, done: 8, limit: true, count: 3, refill: 3 });
    expect(plan.days).toBe(4);
    expect(plan.hitCounter).toBe(true);
  });

  it('do zero, com regeneração de 120, leva 7 dias', () => {
    expect(planOdyle(base).days).toBe(7);
  });

  it('devolve null quando o que entra não cobre o que sai', () => {
    expect(planOdyle({ ...base, cap: 560, regen: 80, reserve: 80 }).days).toBeNull();
  });

  it('contagem já fechada não pede nada', () => {
    const plan = planOdyle({ ...base, done: 21 });
    expect(plan.need).toBe(0);
    expect(plan.rows).toHaveLength(0);
  });
});
