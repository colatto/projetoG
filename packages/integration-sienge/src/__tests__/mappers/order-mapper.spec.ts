import { describe, it, expect } from 'vitest';
import {
  mapOrderToLocal,
  mapOrderItemsToLocal,
  mapDeliverySchedulesToLocal,
  extractOrderQuotationLinks,
} from '../../mappers/order-mapper.js';
import type {
  SiengePurchaseOrder,
  SiengePurchaseOrderItem,
  SiengeDeliverySchedule,
} from '../../types/sienge-types.js';

describe('Order Mapper', () => {
  describe('mapOrderToLocal', () => {
    it('should map Sienge purchase order correctly', () => {
      const source = {
        purchaseOrderId: 100,
        formattedPurchaseOrderId: 'PO-100',
        supplierId: 200,
        buyerId: 'BUY-1',
        buildingId: 300,
        status: 'APPROVED',
        authorized: true,
        disapproved: false,
        deliveryLate: true,
        consistent: 'YES',
        date: '2023-01-01',
      } as unknown as SiengePurchaseOrder;

      const result = mapOrderToLocal(source);

      expect(result).toEqual({
        id: 100,
        formattedPurchaseOrderId: 'PO-100',
        supplierId: 200,
        buyerId: 'BUY-1',
        buildingId: 300,
        siengeStatus: 'APPROVED',
        localStatus: 'PENDENTE',
        authorized: true,
        disapproved: false,
        deliveryLate: true,
        consistent: 'YES',
        date: '2023-01-01',
      });
    });

    it('should handle null optional fields', () => {
      const source = {
        purchaseOrderId: 100,
        supplierId: 200,
      } as unknown as SiengePurchaseOrder;

      const result = mapOrderToLocal(source);

      expect(result.formattedPurchaseOrderId).toBeNull();
      expect(result.buyerId).toBeNull();
      expect(result.buildingId).toBeNull();
      expect(result.siengeStatus).toBeNull();
      expect(result.authorized).toBeNull();
      expect(result.disapproved).toBeNull();
      expect(result.deliveryLate).toBeNull();
      expect(result.consistent).toBeNull();
      expect(result.date).toBeNull();
    });
  });

  describe('mapOrderItemsToLocal', () => {
    it('should map order items correctly', () => {
      const items = [
        {
          purchaseOrderItemNumber: 1,
          quantity: 10,
          unitPrice: 100,
          purchaseQuotationId: 50,
          purchaseQuotationItemId: 5,
        },
        {
          purchaseOrderItemNumber: 2,
        },
      ] as unknown as SiengePurchaseOrderItem[];

      const result = mapOrderItemsToLocal(100, items);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        purchaseOrderId: 100,
        itemNumber: 1,
        quantity: 10,
        unitPrice: 100,
        purchaseQuotationId: 50,
        purchaseQuotationItemId: 5,
      });
      expect(result[1]).toEqual({
        purchaseOrderId: 100,
        itemNumber: 2,
        quantity: null,
        unitPrice: null,
        purchaseQuotationId: null,
        purchaseQuotationItemId: null,
      });
    });
  });

  describe('mapDeliverySchedulesToLocal', () => {
    it('should handle Sienge typos correctly', () => {
      const schedules = [
        { sheduledDate: '2023-01-01', sheduledQuantity: 5 },
      ] as unknown as SiengeDeliverySchedule[];

      const result = mapDeliverySchedulesToLocal(100, 1, schedules);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        purchaseOrderId: 100,
        itemNumber: 1,
        scheduledDate: '2023-01-01',
        scheduledQuantity: 5,
      });
    });
  });

  describe('extractOrderQuotationLinks', () => {
    it('should return empty array if no purchaseQuotations', () => {
      const order = { purchaseOrderId: 100 } as unknown as SiengePurchaseOrder;
      const orderEmpty = {
        purchaseOrderId: 100,
        purchaseQuotations: [],
      } as unknown as SiengePurchaseOrder;

      expect(extractOrderQuotationLinks(order)).toEqual([]);
      expect(extractOrderQuotationLinks(orderEmpty)).toEqual([]);
    });

    it('should extract links correctly', () => {
      const order = {
        purchaseOrderId: 100,
        purchaseQuotations: [{ purchaseQuotationId: 50 }],
      } as unknown as SiengePurchaseOrder;

      const result = extractOrderQuotationLinks(order);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        purchaseOrderId: 100,
        purchaseQuotationId: 50,
      });
    });
  });
});
