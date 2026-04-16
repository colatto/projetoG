/**
 * Resource types tracked by the sync cursor.
 * PRD-07 §4.4
 */
export enum SyncResourceType {
  QUOTATIONS = 'quotations',
  ORDERS = 'orders',
  INVOICES = 'invoices',
  DELIVERIES = 'deliveries',
  CREDITORS = 'creditors',
}

/**
 * Sync cursor status.
 * PRD-07 §4.4
 */
export enum SyncStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  ERROR = 'error',
}
