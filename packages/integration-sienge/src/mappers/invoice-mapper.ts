import type {
  SiengePurchaseInvoice,
  SiengeInvoiceItem,
  SiengeDeliveryAttended,
} from '../types/sienge-types.js';

// ── Local domain shapes ─────────────────────────────────────────

export interface LocalPurchaseInvoice {
  sequentialNumber: number;
  supplierId: number;
  documentId: string | null;
  series: string | null;
  number: string | null;
  issueDate: string | null;
  movementDate: string | null;
  consistency: string | null;
}

export interface LocalInvoiceItem {
  invoiceSequentialNumber: number;
  itemNumber: number;
  quantity: number | null;
}

export interface LocalDelivery {
  purchaseOrderId: number;
  purchaseOrderItemNumber: number;
  deliveryItemNumber: number | null;
  attendedNumber: number | null;
  invoiceSequentialNumber: number | null;
  invoiceItemNumber: number | null;
  deliveredQuantity: number | null;
  deliveryDate: string | null;
  status: string;
}

export interface InvoiceOrderLink {
  sequentialNumber: number;
  invoiceItemNumber: number;
  purchaseOrderId: number;
  purchaseOrderItemNumber: number;
}

// ── Mappers ─────────────────────────────────────────────────────

/**
 * Maps a Sienge purchase invoice to the local `purchase_invoices` entity.
 */
export function mapInvoiceToLocal(source: SiengePurchaseInvoice): LocalPurchaseInvoice {
  return {
    sequentialNumber: source.sequentialNumber,
    supplierId: source.supplierId,
    documentId: source.documentId ?? null,
    series: source.series ?? null,
    number: source.number ?? null,
    issueDate: source.issueDate ?? null,
    movementDate: source.movementDate ?? null,
    consistency: source.consistency ?? null,
  };
}

/**
 * Maps Sienge invoice items to local `invoice_items`.
 */
export function mapInvoiceItemsToLocal(
  sequentialNumber: number,
  items: SiengeInvoiceItem[],
): LocalInvoiceItem[] {
  return items.map((item) => ({
    invoiceSequentialNumber: sequentialNumber,
    itemNumber: item.invoiceItemNumber,
    quantity: item.quantity ?? null,
  }));
}

/**
 * Maps a Sienge delivery attended record to the local `deliveries` entity.
 *
 * The linkage chain (§9.7):
 * Invoice → purchaseOrderId → order item → purchaseQuotationId → Quotation
 */
export function mapDeliveryAttendedToLocal(source: SiengeDeliveryAttended): LocalDelivery {
  return {
    purchaseOrderId: source.purchaseOrderId,
    purchaseOrderItemNumber: source.purchaseOrderItemNumber,
    deliveryItemNumber: source.deliveryItemPurchaseOrderNumber ?? null,
    attendedNumber: source.purchaseOrderItemAttendedNumber ?? null,
    invoiceSequentialNumber: source.sequentialNumber,
    invoiceItemNumber: source.invoiceItemNumber,
    deliveredQuantity: source.quantity ?? null,
    deliveryDate: source.deliveryDate ?? null,
    status: 'AGUARDANDO_VALIDACAO',
  };
}

/**
 * Extracts the invoice→order link from a delivery attended record (§9.7).
 *
 * Anti-pattern avoided (§9.11):
 * - Do NOT link invoice to quotation only by date.
 */
export function extractInvoiceOrderLinks(deliveries: SiengeDeliveryAttended[]): InvoiceOrderLink[] {
  return deliveries.map((d) => ({
    sequentialNumber: d.sequentialNumber,
    invoiceItemNumber: d.invoiceItemNumber,
    purchaseOrderId: d.purchaseOrderId,
    purchaseOrderItemNumber: d.purchaseOrderItemNumber,
  }));
}
