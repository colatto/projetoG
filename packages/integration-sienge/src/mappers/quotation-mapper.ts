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

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Defensive consistency resolver.
 * Accepts both `consistency` (string, documented contract) and `consistent` (boolean, real API 2026-05).
 * Converts boolean → string using the same nomenclature as the purchase-orders API.
 */
function resolveConsistency(source: SiengeQuotationNegotiation): string | null {
  if (source.consistency != null && typeof source.consistency === 'string') {
    return source.consistency;
  }
  if (source.consistent != null && typeof source.consistent === 'boolean') {
    return source.consistent ? 'CONSISTENT' : 'INCONSISTENT';
  }
  return null;
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
    consistency: resolveConsistency(source),
    siengeStatus: source.status ?? null,
  };
}

/**
 * Maps a supplier from the quotation response to local `supplier_negotiations` entities.
 *
 * Supports two response formats:
 * - Documented contract: `supplier.negotiations[]` (array of SiengeNegotiationSummary)
 * - Real API (2026-05): `supplier.latestNegotiation` (single object)
 *
 * If neither is present, returns a single entry with null negotiation IDs.
 */
export function mapSupplierNegotiationsToLocal(
  purchaseQuotationId: number,
  supplier: SiengeQuotationSupplier,
): LocalSupplierNegotiation[] {
  // Path 1: Documented contract — negotiations[] array
  if (supplier.negotiations && supplier.negotiations.length > 0) {
    return supplier.negotiations.map((neg: SiengeNegotiationSummary) => ({
      purchaseQuotationId,
      supplierId: supplier.supplierId,
      siengeNegotiationId: neg.negotiationId,
      siengeNegotiationNumber: neg.negotiationNumber,
      status: neg.authorized ? 'INTEGRADA_SIENGE' : 'AGUARDANDO_RESPOSTA',
      deliveryDate: neg.supplierAnswerDate ?? null,
    }));
  }

  // Path 2: Real API (2026-05) — latestNegotiation single object
  if (supplier.latestNegotiation) {
    const neg = supplier.latestNegotiation;
    return [
      {
        purchaseQuotationId,
        supplierId: supplier.supplierId,
        siengeNegotiationId: neg.negotiationId,
        siengeNegotiationNumber: null, // not available in latestNegotiation
        status: neg.authorized ? 'INTEGRADA_SIENGE' : 'AGUARDANDO_RESPOSTA',
        deliveryDate: neg.responseDate ?? null,
      },
    ];
  }

  // Path 3: No negotiation data at all
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
