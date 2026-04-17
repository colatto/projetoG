import { describe, it, expect } from 'vitest';
import {
  mapQuotationToLocal,
  mapSupplierNegotiationsToLocal,
  mapNegotiationItemsToLocal,
} from '../../mappers/quotation-mapper.js';
import type {
  SiengeQuotationNegotiation,
  SiengeQuotationSupplier,
  SiengeNegotiationItem,
} from '../../types/sienge-types.js';

describe('Quotation Mapper', () => {
  describe('mapQuotationToLocal', () => {
    it('should map Sienge quotation correctly', () => {
      const source = {
        purchaseQuotationId: 10,
        quotationDate: '2023-01-01',
        responseDate: '2023-01-02',
        buyerId: 'B-1',
        consistency: 'CONSISTENT',
        status: 'OPEN',
      } as unknown as SiengeQuotationNegotiation;

      const result = mapQuotationToLocal(source);

      expect(result).toEqual({
        id: 10,
        quotationDate: '2023-01-01',
        responseDate: '2023-01-02',
        buyerId: 'B-1',
        consistency: 'CONSISTENT',
        siengeStatus: 'OPEN',
      });
    });

    it('should handle null optional fields', () => {
      const source = {
        purchaseQuotationId: 10,
      } as unknown as SiengeQuotationNegotiation;

      const result = mapQuotationToLocal(source);

      expect(result.quotationDate).toBeNull();
      expect(result.responseDate).toBeNull();
      expect(result.buyerId).toBeNull();
      expect(result.consistency).toBeNull();
      expect(result.siengeStatus).toBeNull();
    });
  });

  describe('mapSupplierNegotiationsToLocal', () => {
    it('should map supplier with no negotiations', () => {
      const supplier = {
        supplierId: 100,
        negotiations: [],
      } as unknown as SiengeQuotationSupplier;

      const result = mapSupplierNegotiationsToLocal(10, supplier);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        purchaseQuotationId: 10,
        supplierId: 100,
        siengeNegotiationId: null,
        siengeNegotiationNumber: null,
        status: 'AGUARDANDO_RESPOSTA',
        deliveryDate: null,
      });
    });

    it('should map supplier with negotiations', () => {
      const supplier = {
        supplierId: 100,
        negotiations: [
          {
            negotiationId: 1,
            negotiationNumber: 1001,
            authorized: true,
            supplierAnswerDate: '2023-01-02',
          },
          {
            negotiationId: 2,
            negotiationNumber: 1002,
            authorized: false,
            supplierAnswerDate: null,
          },
        ],
      } as unknown as SiengeQuotationSupplier;

      const result = mapSupplierNegotiationsToLocal(10, supplier);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        purchaseQuotationId: 10,
        supplierId: 100,
        siengeNegotiationId: 1,
        siengeNegotiationNumber: 1001,
        status: 'INTEGRADA_SIENGE',
        deliveryDate: '2023-01-02',
      });
      expect(result[1]).toEqual({
        purchaseQuotationId: 10,
        supplierId: 100,
        siengeNegotiationId: 2,
        siengeNegotiationNumber: 1002,
        status: 'AGUARDANDO_RESPOSTA',
        deliveryDate: null,
      });
    });
  });

  describe('mapNegotiationItemsToLocal', () => {
    it('should map negotiation items correctly', () => {
      const items = [
        {
          purchaseQuotationItemId: 1,
          quantity: 10,
          unitPrice: 100,
          deliveryDate: '2023-01-01',
        },
        {
          purchaseQuotationItemId: 2,
          quantity: 20,
          unitPrice: 200,
        },
      ] as unknown as SiengeNegotiationItem[];

      const result = mapNegotiationItemsToLocal(items);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        purchaseQuotationItemId: 1,
        quantity: 10,
        unitPrice: 100,
        deliveryDate: '2023-01-01',
      });
      expect(result[1]).toEqual({
        purchaseQuotationItemId: 2,
        quantity: 20,
        unitPrice: 200,
        deliveryDate: null,
      });
    });
  });
});
