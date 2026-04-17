import { describe, it, expect } from 'vitest';
import {
  mapCreateNegotiationToSienge,
  mapUpdateNegotiationToSienge,
  mapUpdateNegotiationItemToSienge,
} from '../../mappers/negotiation-mapper.js';

describe('Negotiation Mapper', () => {
  describe('mapCreateNegotiationToSienge', () => {
    it('should map local create input to Sienge request body', () => {
      const input = {
        supplierAnswerDate: '2023-01-01',
        validity: 30,
        seller: 'John Doe',
      };

      const result = mapCreateNegotiationToSienge(input);

      expect(result).toEqual({
        supplierAnswerDate: '2023-01-01',
        validity: 30,
        seller: 'John Doe',
      });
    });
  });

  describe('mapUpdateNegotiationToSienge', () => {
    it('should map local update input correctly with only defined fields', () => {
      const input = {
        supplierAnswerDate: '2023-01-01',
        discount: 10,
        applyIpiFreight: true,
      };

      const result = mapUpdateNegotiationToSienge(input);

      expect(result).toEqual({
        supplierAnswerDate: '2023-01-01',
        discount: 10,
        applyIpiFreight: true,
      });
    });

    it('should map all fields correctly', () => {
      const input = {
        supplierAnswerDate: '2023-01-01',
        validity: 30,
        seller: 'John',
        discount: 10,
        freightType: 'CIF',
        freightTypeForGeneratedPurchaseOrder: 'CIF',
        freightPrice: 50,
        valueOtherExpenses: 20,
        applyIpiFreight: true,
        internalNotes: 'Internal',
        supplierNotes: 'Supplier',
        paymentTerms: '30 days',
      };

      const result = mapUpdateNegotiationToSienge(input);

      expect(result).toEqual(input);
    });

    it('should return empty object if no fields are defined', () => {
      const result = mapUpdateNegotiationToSienge({});
      expect(result).toEqual({});
    });
  });

  describe('mapUpdateNegotiationItemToSienge', () => {
    it('should map local item input to Sienge request body', () => {
      const input = {
        unitPrice: 100.5,
        quantity: 10,
        deliveryDate: '2023-01-01',
      };

      const result = mapUpdateNegotiationItemToSienge(input);

      expect(result).toEqual({
        unitPrice: 100.5,
        quantity: 10,
        deliveryDate: '2023-01-01',
      });
    });
  });
});
