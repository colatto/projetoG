import { vi } from 'vitest';

export function createSupabaseMock(customTables: Record<string, unknown> = {}) {
  const chainMocks = new Map<string, unknown>();

  const getOrCreateTableMocks = (table: string) => {
    if (customTables[table]) {
      return customTables[table];
    }

    if (!chainMocks.has(table)) {
      const mocks = {
        select: {
          eq: {
            single: vi.fn(),
            lte: vi.fn(),
          },
          single: vi.fn(),
        },
        update: {
          eq: {
            eq: vi.fn(), // for chained eq().eq()
          },
        },
        delete: {
          eq: vi.fn(),
        },
        insert: vi.fn(),
      };

      const selectEqMock = vi.fn(() => ({
        single: mocks.select.eq.single,
        lte: mocks.select.eq.lte,
      }));
      const selectMock = vi.fn(() => ({
        eq: selectEqMock,
        single: mocks.select.single,
      }));

      const updateEqMock = vi.fn(() => ({
        eq: mocks.update.eq.eq,
      }));
      const updateMock = vi.fn(() => ({
        eq: updateEqMock,
      }));

      const deleteEqMock = vi.fn(() => mocks.delete.eq);
      const deleteMock = vi.fn(() => ({
        eq: deleteEqMock,
      }));

      chainMocks.set(table, {
        select: selectMock,
        update: updateMock,
        delete: deleteMock,
        insert: mocks.insert,

        // Exposed leafs for assertions/mocking:
        selectEq: selectEqMock,
        selectSingle: mocks.select.single,
        selectEqSingle: mocks.select.eq.single,
        selectEqLte: mocks.select.eq.lte,
        updateEq: updateEqMock,
        updateEqEq: mocks.update.eq.eq,
        deleteEq: mocks.delete.eq,
        insertMock: mocks.insert,
      });
    }
    return chainMocks.get(table);
  };

  const fromMock = vi.fn((table: string) => {
    const mocks = getOrCreateTableMocks(table);
    if (!mocks) {
      throw new Error(`Unexpected table: ${table}`);
    }
    return mocks;
  });

  return {
    supabaseClient: { from: fromMock },
    getTableMocks: (table: string) => getOrCreateTableMocks(table),
    fromMock,
  };
}
