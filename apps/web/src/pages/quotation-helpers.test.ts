import { describe, expect, it } from 'vitest';
import {
  formatSupplierNamesCell,
  getDominantNegotiationStatus,
  quotationRowHasClosedSupplier,
  shouldShowInvalidMapMixedChip,
} from './quotation-helpers';

describe('getDominantNegotiationStatus', () => {
  it('returns SEM_RESPOSTA when empty', () => {
    expect(getDominantNegotiationStatus([])).toBe('SEM_RESPOSTA');
  });

  it('prioritizes FORNECEDOR_INVALIDO_MAPA over INTEGRADA_SIENGE (RN-30)', () => {
    expect(
      getDominantNegotiationStatus(['INTEGRADA_SIENGE', 'FORNECEDOR_INVALIDO_MAPA']),
    ).toBe('FORNECEDOR_INVALIDO_MAPA');
  });

  it('returns only integrated when no invalid supplier', () => {
    expect(getDominantNegotiationStatus(['INTEGRADA_SIENGE'])).toBe('INTEGRADA_SIENGE');
  });

  it('prioritizes AGUARDANDO_RESPOSTA over INTEGRADA when both present', () => {
    expect(getDominantNegotiationStatus(['INTEGRADA_SIENGE', 'AGUARDANDO_RESPOSTA'])).toBe(
      'AGUARDANDO_RESPOSTA',
    );
  });

  it('falls back to first unknown status', () => {
    expect(getDominantNegotiationStatus(['CUSTOM_UNKNOWN'])).toBe('CUSTOM_UNKNOWN');
  });
});

describe('shouldShowInvalidMapMixedChip', () => {
  it('is false when dominant is invalid map', () => {
    expect(
      shouldShowInvalidMapMixedChip(
        ['FORNECEDOR_INVALIDO_MAPA', 'INTEGRADA_SIENGE'],
        'FORNECEDOR_INVALIDO_MAPA',
      ),
    ).toBe(false);
  });

  it('is true when invalid exists but dominant is something else', () => {
    expect(
      shouldShowInvalidMapMixedChip(
        ['FORNECEDOR_INVALIDO_MAPA', 'INTEGRADA_SIENGE'],
        'INTEGRADA_SIENGE',
      ),
    ).toBe(true);
  });
});

describe('formatSupplierNamesCell', () => {
  it('returns em dash when no names', () => {
    expect(formatSupplierNamesCell([])).toEqual({ title: '', primary: '—' });
  });

  it('returns single name without suffix', () => {
    expect(formatSupplierNamesCell(['  Acme  '])).toEqual({ title: 'Acme', primary: 'Acme' });
  });

  it('truncates multiple as first +N', () => {
    expect(formatSupplierNamesCell(['A', 'B'])).toEqual({
      title: 'A, B',
      primary: 'A +1',
    });
  });
});

describe('quotationRowHasClosedSupplier', () => {
  it('detects FORNECEDOR_FECHADO', () => {
    expect(
      quotationRowHasClosedSupplier([
        { status: 'FORNECEDOR_FECHADO', closed_order_id: null },
      ]),
    ).toBe(true);
  });

  it('detects closed_order_id', () => {
    expect(
      quotationRowHasClosedSupplier([
        { status: 'APROVADA', closed_order_id: 900 },
      ]),
    ).toBe(true);
  });

  it('false when neither', () => {
    expect(
      quotationRowHasClosedSupplier([{ status: 'AGUARDANDO_RESPOSTA', closed_order_id: null }]),
    ).toBe(false);
  });
});
