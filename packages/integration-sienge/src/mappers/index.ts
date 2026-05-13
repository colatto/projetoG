export {
  mapQuotationToLocal,
  mapSupplierNegotiationsToLocal,
  mapNegotiationItemsToLocal,
} from './quotation-mapper.js';
export type {
  LocalQuotation,
  LocalSupplierNegotiation,
  LocalNegotiationItem,
} from './quotation-mapper.js';

export {
  mapCreditorToSupplier,
  mapCreditorContacts,
  extractCreditorEmail,
} from './creditor-mapper.js';
export type {
  LocalSupplier,
  LocalSupplierContact,
  CreditorEmailResult,
} from './creditor-mapper.js';

export {
  resolveOrderId,
  mapOrderToLocal,
  mapOrderItemsToLocal,
  mapDeliverySchedulesToLocal,
  extractOrderQuotationLinks,
} from './order-mapper.js';
export type {
  LocalPurchaseOrder,
  LocalPurchaseOrderItem,
  LocalDeliverySchedule,
  OrderQuotationLink,
} from './order-mapper.js';

export {
  mapInvoiceToLocal,
  mapInvoiceItemsToLocal,
  mapDeliveryAttendedToLocal,
  extractInvoiceOrderLinks,
} from './invoice-mapper.js';
export type {
  LocalPurchaseInvoice,
  LocalInvoiceItem,
  LocalDelivery,
  InvoiceOrderLink,
} from './invoice-mapper.js';

export {
  mapCreateNegotiationToSienge,
  mapUpdateNegotiationToSienge,
  mapUpdateNegotiationItemToSienge,
} from './negotiation-mapper.js';
export type {
  LocalNegotiationCreateInput,
  LocalNegotiationUpdateInput,
  LocalNegotiationItemInput,
} from './negotiation-mapper.js';
