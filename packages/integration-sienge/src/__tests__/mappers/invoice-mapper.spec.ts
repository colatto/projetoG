import { describe, it, expect } from 'vitest';
import {
  mapInvoiceToLocal,
  mapInvoiceItemsToLocal,
  mapDeliveryAttendedToLocal,
  extractInvoiceOrderLinks,
} from '../../mappers/invoice-mapper.js';
import type {
  SiengePurchaseInvoice,
  SiengeInvoiceItem,
  SiengeDeliveryAttended,
} from '../../types/sienge-types.js';

describe('Invoice Mapper', () => {
  describe('mapInvoiceToLocal', () => {
    it('should map Sienge purchase invoice correctly', () => {
      const source = {
        sequentialNumber: 123,
        supplierId: 456,
        documentId: 'DOC-001',
        series: 'A',
        number: '999',
        issueDate: '2023-01-01',
        movementDate: '2023-01-02',
        consistency: 'CONSISTENT',
      } as unknown as SiengePurchaseInvoice;

      const result = mapInvoiceToLocal(source);

      expect(result).toEqual({
        sequentialNumber: 123,
        supplierId: 456,
        documentId: 'DOC-001',
        series: 'A',
        number: '999',
        issueDate: '2023-01-01',
        movementDate: '2023-01-02',
        consistency: 'CONSISTENT',
      });
    });

    it('should handle null optional fields', () => {
      const source = {
        sequentialNumber: 123,
        supplierId: 456,
      } as unknown as SiengePurchaseInvoice;

      const result = mapInvoiceToLocal(source);

      expect(result.documentId).toBeNull();
      expect(result.series).toBeNull();
      expect(result.number).toBeNull();
      expect(result.issueDate).toBeNull();
      expect(result.movementDate).toBeNull();
      expect(result.consistency).toBeNull();
    });
  });

  describe('mapInvoiceItemsToLocal', () => {
    it('should map invoice items correctly', () => {
      const items = [
        { invoiceItemNumber: 1, quantity: 10 },
        { invoiceItemNumber: 2, quantity: null },
      ] as unknown as SiengeInvoiceItem[];

      const result = mapInvoiceItemsToLocal(123, items);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        invoiceSequentialNumber: 123,
        itemNumber: 1,
        quantity: 10,
      });
      expect(result[1]).toEqual({
        invoiceSequentialNumber: 123,
        itemNumber: 2,
        quantity: null,
      });
    });
  });

  describe('mapDeliveryAttendedToLocal', () => {
    it('should map delivery attended record correctly', () => {
      const source = {
        purchaseOrderId: 10,
        purchaseOrderItemNumber: 20,
        sequentialNumber: 30,
        invoiceItemNumber: 40,
        quantity: 50,
      } as unknown as SiengeDeliveryAttended;

      const result = mapDeliveryAttendedToLocal(source);

      expect(result).toEqual({
        purchaseOrderId: 10,
        purchaseOrderItemNumber: 20,
        invoiceSequentialNumber: 30,
        invoiceItemNumber: 40,
        deliveredQuantity: 50,
        status: 'AGUARDANDO_VALIDACAO',
        attendedNumber: null,
        deliveryDate: null,
        deliveryItemNumber: null,
      });
    });

    it('should handle null quantity', () => {
      const source = {
        purchaseOrderId: 10,
        purchaseOrderItemNumber: 20,
        sequentialNumber: 30,
        invoiceItemNumber: 40,
      } as unknown as SiengeDeliveryAttended;

      const result = mapDeliveryAttendedToLocal(source);

      expect(result.deliveredQuantity).toBeNull();
      expect(result.attendedNumber).toBeNull();
      expect(result.deliveryDate).toBeNull();
      expect(result.deliveryItemNumber).toBeNull();
    });
  });

  describe('extractInvoiceOrderLinks', () => {
    it('should extract invoice order links correctly', () => {
      const deliveries = [
        {
          sequentialNumber: 100,
          invoiceItemNumber: 1,
          purchaseOrderId: 200,
          purchaseOrderItemNumber: 2,
        },
      ] as unknown as SiengeDeliveryAttended[];

      const result = extractInvoiceOrderLinks(deliveries);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        sequentialNumber: 100,
        invoiceItemNumber: 1,
        purchaseOrderId: 200,
        purchaseOrderItemNumber: 2,
      });
    });
  });
});
