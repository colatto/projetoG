import type {
  SiengePurchaseOrder,
  SiengePurchaseOrderItem,
  SiengeDeliverySchedule,
} from '../types/sienge-types.js';

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Resolves the purchase order ID from a Sienge response.
 * The real API (2026-05) uses `id`; the documented contract uses `purchaseOrderId`.
 * This helper accepts both and throws if neither is present.
 */
export function resolveOrderId(source: SiengePurchaseOrder): number {
  const resolved = source.id ?? source.purchaseOrderId;
  if (resolved == null) {
    throw new Error(
      'Cannot resolve purchase order ID: both `id` and `purchaseOrderId` are missing from Sienge payload',
    );
  }
  return resolved;
}

// ── Local domain shapes ─────────────────────────────────────────

export interface LocalPurchaseOrder {
  id: number;
  formattedPurchaseOrderId: string | null;
  supplierId: number;
  buyerId: string | null;
  buildingId: number | null;
  siengeStatus: string | null;
  localStatus: string;
  authorized: boolean | null;
  disapproved: boolean | null;
  deliveryLate: boolean | null;
  consistent: string | null;
  date: string | null;
}

export interface LocalPurchaseOrderItem {
  purchaseOrderId: number;
  itemNumber: number;
  quantity: number | null;
  unitPrice: number | null;
  purchaseQuotationId: number | null;
  purchaseQuotationItemId: number | null;
}

export interface LocalDeliverySchedule {
  purchaseOrderId: number;
  itemNumber: number;
  scheduledDate: string;
  scheduledQuantity: number;
}

export interface OrderQuotationLink {
  purchaseOrderId: number;
  purchaseQuotationId: number;
}

// ── Mappers ─────────────────────────────────────────────────────

/**
 * Maps a Sienge purchase order to the local `purchase_orders` entity.
 */
export function mapOrderToLocal(source: SiengePurchaseOrder): LocalPurchaseOrder {
  const orderId = resolveOrderId(source);
  return {
    id: orderId,
    formattedPurchaseOrderId: source.formattedPurchaseOrderId ?? null,
    supplierId: source.supplierId,
    buyerId: source.buyerId ?? null,
    buildingId: source.buildingId ?? null,
    siengeStatus: source.status ?? null,
    localStatus: 'PENDENTE',
    authorized: source.authorized ?? null,
    disapproved: source.disapproved ?? null,
    deliveryLate: source.deliveryLate ?? null,
    consistent: source.consistent ?? null,
    date: source.date ?? null,
  };
}

/**
 * Maps Sienge purchase order items to local `purchase_order_items`.
 */
export function mapOrderItemsToLocal(
  purchaseOrderId: number,
  items: SiengePurchaseOrderItem[],
): LocalPurchaseOrderItem[] {
  return items.map((item) => ({
    purchaseOrderId,
    itemNumber: item.purchaseOrderItemNumber,
    quantity: item.quantity ?? null,
    unitPrice: item.unitPrice ?? null,
    purchaseQuotationId: item.purchaseQuotationId ?? null,
    purchaseQuotationItemId: item.purchaseQuotationItemId ?? null,
  }));
}

/**
 * Maps Sienge delivery schedules to local format.
 * Normalizes the Sienge typo: `sheduledDate` → `scheduledDate` (RN-11).
 */
export function mapDeliverySchedulesToLocal(
  purchaseOrderId: number,
  itemNumber: number,
  schedules: SiengeDeliverySchedule[],
): LocalDeliverySchedule[] {
  return schedules.map((s) => ({
    purchaseOrderId,
    itemNumber,
    scheduledDate: s.sheduledDate, // Sienge typo (RN-11)
    scheduledQuantity: s.sheduledQuantity, // Sienge typo (RN-11)
  }));
}

/**
 * Extracts the order→quotation link from a purchase order (§9.6).
 *
 * The PRIMARY linkage comes from the webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION`.
 * The `purchaseQuotations[]` in the order detail is a SECONDARY confirmation.
 *
 * Anti-patterns avoided (§9.11):
 * - Do NOT link order to quotation only by supplier name.
 * - Do NOT link order to quotation only by dates.
 * - Do NOT use order item as the SOLE rule to discover the main quotation.
 */
export function extractOrderQuotationLinks(order: SiengePurchaseOrder): OrderQuotationLink[] {
  if (!order.purchaseQuotations || order.purchaseQuotations.length === 0) {
    return [];
  }

  const orderId = resolveOrderId(order);
  return order.purchaseQuotations.map((link) => ({
    purchaseOrderId: orderId,
    purchaseQuotationId: link.purchaseQuotationId,
  }));
}
