/**
 * TypeScript types for Sienge API payloads.
 * Derived from PRD-07 §7.1, §7.2 and PRDGlobal §9.3.
 */

// ============================================================
// Pagination
// ============================================================

export interface SiengePaginatedResponse<T> {
  resultSetMetadata: {
    count: number;
    offset: number;
    limit: number;
  };
  results: T[];
}

// ============================================================
// Quotations (§9.3.1)
// ============================================================

export interface SiengeQuotationNegotiation {
  purchaseQuotationId: number;
  quotationNumber: string;
  buyerId: string;
  buyerName: string;
  status: string;
  consistency: string;
  quotationDate: string;
  responseDate: string;
  suppliers: SiengeQuotationSupplier[];
}

export interface SiengeQuotationSupplier {
  supplierId: number;
  creditorId: number;
  creditorName: string;
  negotiations: SiengeNegotiationSummary[];
}

export interface SiengeNegotiationSummary {
  negotiationId: number;
  negotiationNumber: number;
  authorized: boolean;
  supplierAnswerDate: string | null;
  items: SiengeNegotiationItem[];
}

export interface SiengeNegotiationItem {
  quotationItemNumber: number;
  purchaseQuotationItemId: number;
  quantity: number;
  unitPrice: number;
  deliveryDate: string | null;
}

// ============================================================
// Creditors (§9.3.2)
// ============================================================

export interface SiengeCreditor {
  creditorId: number;
  creditorName: string;
  tradeName: string | null;
  cpf: string | null;
  cnpj: string | null;
  contacts: SiengeCreditorContact[];
}

export interface SiengeCreditorContact {
  contactId: number;
  name: string;
  email: string | null;
  phone: string | null;
}

// ============================================================
// Purchase Orders (§9.3.3)
// ============================================================

export interface SiengePurchaseOrder {
  purchaseOrderId: number;
  formattedPurchaseOrderId: string;
  supplierId: number;
  buyerId: string;
  buildingId: number;
  status: string;
  authorized: boolean;
  disapproved: boolean;
  deliveryLate: boolean;
  consistent: string;
  date: string;
  purchaseQuotations: SiengeOrderQuotationLink[];
}

export interface SiengeOrderQuotationLink {
  purchaseQuotationId: number;
  quotationNumber: string;
}

export interface SiengePurchaseOrderItem {
  purchaseOrderItemNumber: number;
  quantity: number;
  unitPrice: number;
  purchaseQuotationId: number | null;
  purchaseQuotationItemId: number | null;
}

// Delivery Schedules (§9.3.4) — note the typo in Sienge API (RN-11)
export interface SiengeDeliverySchedule {
  /** Typo from Sienge API: "sheduledDate" without the 'c' (RN-11) */
  sheduledDate: string;
  /** Typo from Sienge API: "sheduledQuantity" without the 'c' (RN-11) */
  sheduledQuantity: number;
}

// ============================================================
// Purchase Invoices (§9.3.5)
// ============================================================

export interface SiengePurchaseInvoice {
  sequentialNumber: number;
  supplierId: number;
  documentId: string;
  series: string;
  number: string;
  issueDate: string;
  movementDate: string;
  consistency: string;
}

export interface SiengeInvoiceItem {
  invoiceItemNumber: number;
  quantity: number;
}

export interface SiengeDeliveryAttended {
  billId: number;
  sequentialNumber: number;
  invoiceItemNumber: number;
  purchaseOrderId: number;
  purchaseOrderItemNumber: number;
  quantity: number;
}

// ============================================================
// Delivery Requirements (§9.3.6)
// ============================================================

export interface SiengeDeliveryRequirement {
  purchaseRequestId: number;
  purchaseRequestItemNumber: number;
  openQuantity: number | string; // §17.9: type may vary
}

// ============================================================
// Negotiation Write (§9.3.7)
// ============================================================

export interface CreateNegotiationRequest {
  supplierAnswerDate: string;
  validity: number;
  seller: string;
}

export interface UpdateNegotiationRequest {
  supplierAnswerDate?: string;
  validity?: number;
  seller?: string;
  discount?: number;
  freightType?: string;
  freightTypeForGeneratedPurchaseOrder?: string;
  freightPrice?: number;
  valueOtherExpenses?: number;
  applyIpiFreight?: boolean;
  internalNotes?: string;
  supplierNotes?: string;
  paymentTerms?: string;
}

export interface UpdateNegotiationItemRequest {
  unitPrice: number;
  quantity: number;
  deliveryDate: string;
}

// ============================================================
// Webhooks (§9.2)
// ============================================================

export type SiengeWebhookType =
  | 'PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION'
  | 'PURCHASE_QUOTATION_NEGOTIATION_AUTHORIZATION_CHANGED'
  | 'PURCHASE_ORDER_AUTHORIZATION_CHANGED'
  | 'PURCHASE_ORDER_ITEM_MODIFIED'
  | 'PURCHASE_ORDER_FINANCIAL_FORECAST_UPDATED';

export interface SiengeWebhookPayload {
  type: SiengeWebhookType;
  data: Record<string, unknown>;
}
