import type {
  CreateNegotiationRequest,
  UpdateNegotiationRequest,
  UpdateNegotiationItemRequest,
} from '../types/sienge-types.js';

// ── Local domain shapes (inbound from the local system) ─────────

export interface LocalNegotiationCreateInput {
  supplierAnswerDate: string;
  validity: number;
  seller: string;
}

export interface LocalNegotiationUpdateInput {
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

export interface LocalNegotiationItemInput {
  unitPrice: number;
  quantity: number;
  deliveryDate: string;
}

// ── Mappers (local → Sienge request body) ───────────────────────

/**
 * Maps a local negotiation create input to the Sienge POST request body.
 */
export function mapCreateNegotiationToSienge(
  input: LocalNegotiationCreateInput,
): CreateNegotiationRequest {
  return {
    supplierAnswerDate: input.supplierAnswerDate,
    validity: input.validity,
    seller: input.seller,
  };
}

/**
 * Maps a local negotiation update input to the Sienge PUT request body.
 * Only includes fields that have defined values.
 */
export function mapUpdateNegotiationToSienge(
  input: LocalNegotiationUpdateInput,
): UpdateNegotiationRequest {
  const body: UpdateNegotiationRequest = {};

  if (input.supplierAnswerDate !== undefined) body.supplierAnswerDate = input.supplierAnswerDate;
  if (input.validity !== undefined) body.validity = input.validity;
  if (input.seller !== undefined) body.seller = input.seller;
  if (input.discount !== undefined) body.discount = input.discount;
  if (input.freightType !== undefined) body.freightType = input.freightType;
  if (input.freightTypeForGeneratedPurchaseOrder !== undefined) {
    body.freightTypeForGeneratedPurchaseOrder = input.freightTypeForGeneratedPurchaseOrder;
  }
  if (input.freightPrice !== undefined) body.freightPrice = input.freightPrice;
  if (input.valueOtherExpenses !== undefined) body.valueOtherExpenses = input.valueOtherExpenses;
  if (input.applyIpiFreight !== undefined) body.applyIpiFreight = input.applyIpiFreight;
  if (input.internalNotes !== undefined) body.internalNotes = input.internalNotes;
  if (input.supplierNotes !== undefined) body.supplierNotes = input.supplierNotes;
  if (input.paymentTerms !== undefined) body.paymentTerms = input.paymentTerms;

  return body;
}

/**
 * Maps a local negotiation item input to the Sienge PUT request body.
 */
export function mapUpdateNegotiationItemToSienge(
  input: LocalNegotiationItemInput,
): UpdateNegotiationItemRequest {
  return {
    unitPrice: input.unitPrice,
    quantity: input.quantity,
    deliveryDate: input.deliveryDate,
  };
}
