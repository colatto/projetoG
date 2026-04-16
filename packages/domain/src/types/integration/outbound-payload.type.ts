export interface OutboundNegotiationPayload {
  purchaseQuotationId: number;
  supplierId: number;
  idempotencyKey: string;
  items: Array<{
    purchaseQuotationItemId: number;
    unitPrice: number;
    quantity: number;
    deliveryDate: string;
  }>;
  supplierAnswerDate: string;
  validity: number;
  seller: string;
  actorId: string;
}
