import type {
  SiengeQuotationNegotiation,
  SiengeQuotationSupplier,
  SiengeNegotiationSummary,
  SiengeNegotiationItem,
} from '../types/sienge-types.js';

// ── Local domain shapes ─────────────────────────────────────────

export interface LocalQuotation {
  id: number;
  quotationDate: string | null;
  responseDate: string | null;
  buyerId: string | null;
  consistency: string | null;
  siengeStatus: string | null;
}

export interface LocalSupplierNegotiation {
  purchaseQuotationId: number;
  supplierId: number;
  siengeNegotiationId: number | null;
  siengeNegotiationNumber: number | null;
  status: string;
  deliveryDate: string | null;
}

export interface LocalNegotiationItem {
  purchaseQuotationItemId: number;
  quantity: number;
  unitPrice: number;
  deliveryDate: string | null;
}

// ── Mappers ─────────────────────────────────────────────────────

/**
 * Maps a Sienge quotation negotiation response to the local `purchase_quotations` entity.
 */
export function mapQuotationToLocal(source: SiengeQuotationNegotiation): LocalQuotation {
  return {
    id: source.purchaseQuotationId,
    quotationDate: source.quotationDate ?? null,
    responseDate: source.responseDate ?? null,
    buyerId: source.buyerId ?? null,
    consistency: source.consistency ?? null,
    siengeStatus: source.status ?? null,
  };
}

/**
 * Maps a supplier from the quotation response to a local `supplier_negotiations` entity.
 * If the supplier has negotiations, returns one entry per negotiation.
 * If no negotiations exist, returns a single entry with null negotiation IDs.
 */
export function mapSupplierNegotiationsToLocal(
  purchaseQuotationId: number,
  supplier: SiengeQuotationSupplier,
): LocalSupplierNegotiation[] {
  if (!supplier.negotiations || supplier.negotiations.length === 0) {
    return [
      {
        purchaseQuotationId,
        supplierId: supplier.supplierId,
        siengeNegotiationId: null,
        siengeNegotiationNumber: null,
        status: 'AGUARDANDO_RESPOSTA',
        deliveryDate: null,
      },
    ];
  }

  return supplier.negotiations.map((neg: SiengeNegotiationSummary) => ({
    purchaseQuotationId,
    supplierId: supplier.supplierId,
    siengeNegotiationId: neg.negotiationId,
    siengeNegotiationNumber: neg.negotiationNumber,
    status: neg.authorized ? 'INTEGRADA_SIENGE' : 'AGUARDANDO_RESPOSTA',
    deliveryDate: neg.supplierAnswerDate ?? null,
  }));
}

/**
 * Maps negotiation items from Sienge to local `supplier_negotiation_items`.
 */
export function mapNegotiationItemsToLocal(items: SiengeNegotiationItem[]): LocalNegotiationItem[] {
  return items.map((item) => ({
    purchaseQuotationItemId: item.purchaseQuotationItemId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    deliveryDate: item.deliveryDate ?? null,
  }));
}
