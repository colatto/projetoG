// Core client
export { SiengeClient, createSiengeClient } from './client.js';
export type { RequestContext, RateLimitConfig } from './client.js';

// Configuration
export { siengeConfigSchema } from './config/env.js';
export type { SiengeConfig } from './config/env.js';

// Crypto
export { encryptSiengeCredential, decryptSiengeCredential } from './crypto.js';

// Specialized clients
export {
  QuotationClient,
  CreditorClient,
  OrderClient,
  InvoiceClient,
  DeliveryRequirementClient,
  NegotiationClient,
} from './clients/index.js';

export type {
  ListNegotiationsFilters,
  ListCreditorsFilters,
  ListOrdersFilters,
  ListInvoicesFilters,
  ListDeliveriesAttendedFilters,
} from './clients/index.js';

// Mappers
export {
  mapQuotationToLocal,
  mapSupplierNegotiationsToLocal,
  mapNegotiationItemsToLocal,
  mapCreditorToSupplier,
  mapCreditorContacts,
  extractCreditorEmail,
  mapOrderToLocal,
  mapOrderItemsToLocal,
  mapDeliverySchedulesToLocal,
  extractOrderQuotationLinks,
  mapInvoiceToLocal,
  mapInvoiceItemsToLocal,
  mapDeliveryAttendedToLocal,
  extractInvoiceOrderLinks,
  mapCreateNegotiationToSienge,
  mapUpdateNegotiationToSienge,
  mapUpdateNegotiationItemToSienge,
} from './mappers/index.js';

export type {
  LocalQuotation,
  LocalSupplierNegotiation,
  LocalNegotiationItem,
  LocalSupplier,
  LocalSupplierContact,
  CreditorEmailResult,
  LocalPurchaseOrder,
  LocalPurchaseOrderItem,
  LocalDeliverySchedule,
  OrderQuotationLink,
  LocalPurchaseInvoice,
  LocalInvoiceItem,
  LocalDelivery,
  InvoiceOrderLink,
  LocalNegotiationCreateInput,
  LocalNegotiationUpdateInput,
  LocalNegotiationItemInput,
} from './mappers/index.js';

// Types
export type {
  SiengePaginatedResponse,
  SiengeQuotationNegotiation,
  SiengeQuotationSupplier,
  SiengeNegotiationSummary,
  SiengeNegotiationItem,
  SiengeCreditor,
  SiengeCreditorContact,
  SiengePurchaseOrder,
  SiengeOrderQuotationLink,
  SiengePurchaseOrderItem,
  SiengeDeliverySchedule,
  SiengePurchaseInvoice,
  SiengeInvoiceItem,
  SiengeDeliveryAttended,
  SiengeDeliveryRequirement,
  CreateNegotiationRequest,
  UpdateNegotiationRequest,
  UpdateNegotiationItemRequest,
  SiengeWebhookType,
  SiengeWebhookPayload,
} from './types/index.js';
