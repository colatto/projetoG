import {
  IntegrationEventType,
  IntegrationEventStatus,
  IntegrationDirection,
  IntegrationEntityType,
} from '../enums/index.js';

/** Default retry configuration per PRD-07 §6.6, RN-13 */
const DEFAULT_MAX_RETRIES_READ = 5;
const DEFAULT_MAX_RETRIES_WRITE = 2;
const RETRY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface IntegrationEventProps {
  id?: string;
  eventType: IntegrationEventType;
  direction: IntegrationDirection;
  endpoint: string;
  httpMethod: string;
  httpStatus?: number;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  status?: IntegrationEventStatus;
  errorMessage?: string;
  retryCount?: number;
  maxRetries?: number;
  nextRetryAt?: Date;
  relatedEntityType?: IntegrationEntityType;
  relatedEntityId?: string;
  idempotencyKey?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Domain entity for integration events.
 * Tracks every HTTP call to/from the Sienge API for auditability,
 * retry management, and operational diagnostics.
 *
 * PRD-07 §4.2, §6.6, §10
 */
export class IntegrationEvent {
  private props: Required<
    Pick<
      IntegrationEventProps,
      'eventType' | 'direction' | 'endpoint' | 'httpMethod' | 'status' | 'retryCount' | 'maxRetries'
    >
  > &
    IntegrationEventProps;

  constructor(props: IntegrationEventProps) {
    this.validate(props);

    const isWrite = props.direction === IntegrationDirection.OUTBOUND;

    this.props = {
      ...props,
      status: props.status ?? IntegrationEventStatus.PENDING,
      retryCount: props.retryCount ?? 0,
      maxRetries:
        props.maxRetries ?? (isWrite ? DEFAULT_MAX_RETRIES_WRITE : DEFAULT_MAX_RETRIES_READ),
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };
  }

  private validate(props: IntegrationEventProps): void {
    if (!props.eventType) throw new Error('IntegrationEvent: eventType is required');
    if (!props.direction) throw new Error('IntegrationEvent: direction is required');
    if (!props.endpoint) throw new Error('IntegrationEvent: endpoint is required');
    if (!props.httpMethod) throw new Error('IntegrationEvent: httpMethod is required');
  }

  // ── Getters ─────────────────────────────────────────────────────

  get id(): string | undefined {
    return this.props.id;
  }
  get eventType(): IntegrationEventType {
    return this.props.eventType;
  }
  get direction(): IntegrationDirection {
    return this.props.direction;
  }
  get endpoint(): string {
    return this.props.endpoint;
  }
  get httpMethod(): string {
    return this.props.httpMethod;
  }
  get httpStatus(): number | undefined {
    return this.props.httpStatus;
  }
  get requestPayload(): Record<string, unknown> | undefined {
    return this.props.requestPayload;
  }
  get responsePayload(): Record<string, unknown> | undefined {
    return this.props.responsePayload;
  }
  get status(): IntegrationEventStatus {
    return this.props.status;
  }
  get errorMessage(): string | undefined {
    return this.props.errorMessage;
  }
  get retryCount(): number {
    return this.props.retryCount;
  }
  get maxRetries(): number {
    return this.props.maxRetries;
  }
  get nextRetryAt(): Date | undefined {
    return this.props.nextRetryAt;
  }
  get relatedEntityType(): IntegrationEntityType | undefined {
    return this.props.relatedEntityType;
  }
  get relatedEntityId(): string | undefined {
    return this.props.relatedEntityId;
  }
  get idempotencyKey(): string | undefined {
    return this.props.idempotencyKey;
  }
  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }
  get updatedAt(): Date | undefined {
    return this.props.updatedAt;
  }

  // ── State Transitions ─────────────────────────────────────────

  /**
   * Marks this event as successful.
   */
  markSuccess(httpStatus: number, responsePayload?: Record<string, unknown>): void {
    this.props.status = IntegrationEventStatus.SUCCESS;
    this.props.httpStatus = httpStatus;
    this.props.responsePayload = responsePayload;
    this.props.errorMessage = undefined;
    this.props.nextRetryAt = undefined;
    this.props.updatedAt = new Date();
  }

  /**
   * Marks this event as failed. If retries are available,
   * schedules the next retry at +24h (RN-13).
   * Returns true if a retry was scheduled.
   */
  markFailure(httpStatus: number | undefined, errorMessage: string): boolean {
    this.props.httpStatus = httpStatus;
    this.props.errorMessage = errorMessage;
    this.props.updatedAt = new Date();

    if (this.props.retryCount < this.props.maxRetries) {
      this.props.status = IntegrationEventStatus.RETRY_SCHEDULED;
      this.props.retryCount += 1;
      this.props.nextRetryAt = new Date(Date.now() + RETRY_INTERVAL_MS);
      return true;
    }

    this.props.status = IntegrationEventStatus.FAILURE;
    this.props.nextRetryAt = undefined;
    return false;
  }

  /**
   * Resets retry state for manual reprocessing by `Compras`.
   * No limit on manual retries in V1.0 (PRD-07 §6.6).
   */
  resetForManualRetry(): void {
    this.props.status = IntegrationEventStatus.RETRY_SCHEDULED;
    this.props.retryCount = 0;
    this.props.nextRetryAt = new Date();
    this.props.errorMessage = undefined;
    this.props.updatedAt = new Date();
  }

  // ── Query Helpers ─────────────────────────────────────────────

  get isRetryable(): boolean {
    return (
      this.props.status === IntegrationEventStatus.RETRY_SCHEDULED &&
      this.props.nextRetryAt !== undefined &&
      this.props.nextRetryAt <= new Date()
    );
  }

  get hasExhaustedRetries(): boolean {
    return this.props.retryCount >= this.props.maxRetries;
  }

  get isOutbound(): boolean {
    return this.props.direction === IntegrationDirection.OUTBOUND;
  }

  /**
   * Serializes to a plain object suitable for database persistence.
   */
  toRecord(): Record<string, unknown> {
    return {
      id: this.props.id,
      event_type: this.props.eventType,
      direction: this.props.direction,
      endpoint: this.props.endpoint,
      http_method: this.props.httpMethod,
      http_status: this.props.httpStatus ?? null,
      request_payload: this.props.requestPayload ?? null,
      response_payload: this.props.responsePayload ?? null,
      status: this.props.status,
      error_message: this.props.errorMessage ?? null,
      retry_count: this.props.retryCount,
      max_retries: this.props.maxRetries,
      next_retry_at: this.props.nextRetryAt?.toISOString() ?? null,
      related_entity_type: this.props.relatedEntityType ?? null,
      related_entity_id: this.props.relatedEntityId ?? null,
      idempotency_key: this.props.idempotencyKey ?? null,
    };
  }
}
