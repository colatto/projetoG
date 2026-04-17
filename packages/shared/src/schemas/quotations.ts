import { z } from 'zod';

// ============================================================
// GET /api/quotations — query params (backoffice)
// ============================================================

export const quotationsQuerySchema = z.object({
  status: z.string().min(1).optional(),
  supplier_id: z.preprocess(
    (a) => (a ? parseInt(String(a), 10) : undefined),
    z.number().int().positive().optional(),
  ),
  require_action: z.preprocess(
    (a) => (a === undefined ? undefined : String(a) === 'true'),
    z.boolean().optional(),
  ),
  date_from: z.string().datetime({ offset: true }).optional(),
  date_to: z.string().datetime({ offset: true }).optional(),
  page: z.preprocess(
    (a) => (a ? parseInt(String(a), 10) : undefined),
    z.number().int().min(1).optional().default(1),
  ),
  limit: z.preprocess(
    (a) => (a ? parseInt(String(a), 10) : undefined),
    z.number().int().min(1).max(100).optional().default(20),
  ),
});

export type QuotationsQueryDto = z.infer<typeof quotationsQuerySchema>;

// ============================================================
// Common params
// ============================================================

export const quotationIdParamSchema = z.object({
  quotation_id: z.preprocess(
    (a) => parseInt(String(a), 10),
    z.number().int().positive('quotation_id inválido'),
  ),
});

export type QuotationIdParamDto = z.infer<typeof quotationIdParamSchema>;

export const quotationSupplierParamSchema = z.object({
  quotation_id: z.preprocess((a) => parseInt(String(a), 10), z.number().int().positive()),
  supplier_id: z.preprocess((a) => parseInt(String(a), 10), z.number().int().positive()),
});

export type QuotationSupplierParamDto = z.infer<typeof quotationSupplierParamSchema>;

// ============================================================
// POST /api/quotations/:quotation_id/send — body
// ============================================================

export const quotationSendBodySchema = z.object({
  end_at: z.string().datetime({ offset: true }).optional(),
  // compat: allow YYYY-MM-DD when clients don't handle timezones yet
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato deve ser YYYY-MM-DD')
    .optional(),
});

export type QuotationSendBodyDto = z.infer<typeof quotationSendBodySchema>;

// ============================================================
// POST /api/supplier/quotations/:quotation_id/respond — body
// ============================================================

export const quotationRespondBodySchema = z.object({
  supplierAnswerDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato deve ser YYYY-MM-DD'),
  validity: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato deve ser YYYY-MM-DD').optional(),
  seller: z.string().min(1).optional(),
  discount: z.number().min(0).optional(),
  freightType: z.string().min(1).optional(),
  freightTypeForOrder: z.string().min(1).optional(),
  freightPrice: z.number().min(0).optional(),
  otherExpenses: z.number().min(0).optional(),
  applyIpiFreight: z.boolean().optional(),
  internalNotes: z.string().optional(),
  supplierNotes: z.string().optional(),
  paymentTerms: z.string().optional(),
  items: z
    .array(
      z.object({
        purchaseQuotationItemId: z.number().int().positive(),
        quotationItemNumber: z.number().int().positive(),
        detailId: z.number().int().positive().optional(),
        trademarkId: z.number().int().positive().optional(),
        quotedQuantity: z.number().min(0),
        negotiatedQuantity: z.number().min(0),
        unitPrice: z.number().min(0),
        discount: z.number().min(0).optional(),
        discountPercentage: z.number().min(0).optional(),
        increasePercentage: z.number().min(0).optional(),
        ipiTaxPercentage: z.number().min(0).optional(),
        issTaxPercentage: z.number().min(0).optional(),
        icmsTaxPercentage: z.number().min(0).optional(),
        freightUnitPrice: z.number().min(0).optional(),
        selectedOption: z.boolean().optional(),
        internalNotes: z.string().optional(),
        supplierNotes: z.string().optional(),
        deliveries: z
          .array(
            z.object({
              deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato deve ser YYYY-MM-DD'),
              deliveryQuantity: z.number().min(0),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

export type QuotationRespondBodyDto = z.infer<typeof quotationRespondBodySchema>;

// ============================================================
// POST /api/quotations/:quotation_id/suppliers/:supplier_id/review — body
// ============================================================

export const quotationReviewBodySchema = z.object({
  action: z.enum(['approve', 'reject', 'request_correction']),
  notes: z.string().optional(),
});

export type QuotationReviewBodyDto = z.infer<typeof quotationReviewBodySchema>;

