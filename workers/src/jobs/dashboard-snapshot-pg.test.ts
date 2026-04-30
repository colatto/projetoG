import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockQuery: vi.fn().mockResolvedValue({ rows: [] }),
  mockRelease: vi.fn(),
}));

vi.mock('pg', () => ({
  default: {
    Pool: class {
      async connect() {
        return { query: hoisted.mockQuery, release: hoisted.mockRelease };
      }
    },
  },
}));

import { replaceDashboardSnapshotBundle } from './dashboard-snapshot-pg.js';

describe('replaceDashboardSnapshotBundle', () => {
  beforeEach(() => {
    hoisted.mockQuery.mockClear();
    hoisted.mockRelease.mockClear();
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  });

  it('runs BEGIN, DELETEs, INSERTs and COMMIT in order', async () => {
    const globalRow = {
      snapshot_date: '2026-04-28',
      cotacoes_enviadas: 1,
      cotacoes_respondidas: 1,
      cotacoes_sem_resposta: 0,
      pedidos_no_prazo: 2,
      pedidos_atrasados: 1,
      pedidos_com_avaria: 0,
      total_pedidos_monitorados: 3,
      lead_time_medio_dias_uteis: 4.5,
      created_at: '2026-04-29T10:00:00.000Z',
    };
    await replaceDashboardSnapshotBundle(
      '2026-04-28',
      globalRow,
      [
        {
          snapshot_date: '2026-04-28',
          supplier_id: 10,
          supplier_name: 'ACME',
          cotacoes_enviadas: 1,
          cotacoes_respondidas: 1,
          pedidos_no_prazo: 1,
          pedidos_atrasados: 0,
          pedidos_com_avaria: 0,
          lead_time_medio_dias_uteis: 5,
          confiabilidade: 'confiavel',
          created_at: '2026-04-29T10:00:00.000Z',
        },
      ],
      [],
      [],
    );

    const texts = hoisted.mockQuery.mock.calls.map((c) => String(c[0]));
    expect(texts[0]).toContain('BEGIN');
    expect(texts.some((t) => t.includes('DELETE FROM public.dashboard_criticidade_item'))).toBe(
      true,
    );
    expect(texts.some((t) => t.includes('DELETE FROM public.dashboard_snapshot'))).toBe(true);
    expect(texts.some((t) => t.includes('INSERT INTO public.dashboard_snapshot'))).toBe(true);
    expect(texts.some((t) => t.includes('INSERT INTO public.dashboard_snapshot_por_fornecedor'))).toBe(
      true,
    );
    expect(texts[texts.length - 1]).toContain('COMMIT');
    expect(hoisted.mockRelease).toHaveBeenCalled();
  });

  it('ROLLBACK on failure', async () => {
    hoisted.mockQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('INSERT INTO public.dashboard_snapshot')) {
        throw new Error('insert failed');
      }
      return { rows: [] };
    });

    const globalRow = {
      snapshot_date: '2026-04-27',
      cotacoes_enviadas: 0,
      cotacoes_respondidas: 0,
      cotacoes_sem_resposta: 0,
      pedidos_no_prazo: 0,
      pedidos_atrasados: 0,
      pedidos_com_avaria: 0,
      total_pedidos_monitorados: 0,
      lead_time_medio_dias_uteis: null,
      created_at: '2026-04-29T10:00:00.000Z',
    };

    await expect(
      replaceDashboardSnapshotBundle('2026-04-27', globalRow, [], [], []),
    ).rejects.toThrow('insert failed');

    const texts = hoisted.mockQuery.mock.calls.map((c) => String(c[0]));
    expect(texts.some((t) => t.includes('ROLLBACK'))).toBe(true);
  });
});
