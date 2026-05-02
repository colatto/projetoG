/**
 * Types of integration events tracked in `integration_events`.
 * PRD-07 §4.2, §10
 */
export enum IntegrationEventType {
  SYNC_QUOTATIONS = 'sync_quotations',
  SYNC_CREDITOR = 'sync_creditor',
  SYNC_ORDERS = 'sync_orders',
  SYNC_DELIVERIES = 'sync_deliveries',
  WRITE_NEGOTIATION = 'write_negotiation',
  AUTHORIZE_NEGOTIATION = 'authorize_negotiation',
  SUPPLIER_INVALID_MAP = 'supplier_invalid_map',
  INTEGRATION_RETRY = 'integration_retry',
  WEBHOOK_RECEIVED = 'webhook_received',
  WEBHOOK_PROCESSED = 'webhook_processed',
  WEBHOOK_FAILED = 'webhook_failed',
  RECONCILIATION_DIVERGENCE = 'reconciliation_divergence',
}

/**
 * Status of an integration event.
 * PRD-07 §4.2
 */
export enum IntegrationEventStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILURE = 'failure',
  RETRY_SCHEDULED = 'retry_scheduled',
}

/**
 * Direction of an integration event.
 * PRD-07 §4.2
 */
export enum IntegrationDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

/**
 * Related entity types for integration events.
 * PRD-07 §4.2
 */
export enum IntegrationEntityType {
  QUOTATION = 'quotation',
  ORDER = 'order',
  INVOICE = 'invoice',
  CREDITOR = 'creditor',
  /** Contratos suprimentos — webhooks CONTRACT_* (PRD-07 §9.2) */
  CONTRACT = 'contract',
  /** Medições de contrato — webhooks MEASUREMENT_* */
  MEASUREMENT = 'measurement',
  /** Quitação/clearing — webhooks CLEARING_* */
  CLEARING = 'clearing',
}
