import { WebhookType, WebhookStatus } from '../enums/index.js';

export interface WebhookEventProps {
  id?: string;
  webhookType: WebhookType;
  payload: Record<string, unknown>;
  siengeDeliveryId?: string;
  siengeHookId?: string;
  siengeEvent?: string;
  siengeTenant?: string;
  status?: WebhookStatus;
  processedAt?: Date;
  errorMessage?: string;
  createdAt?: Date;
}

/**
 * Domain entity for webhook events received from Sienge.
 * Tracks the lifecycle: received → processing → processed | failed.
 *
 * PRD-07 §4.3, §6.5
 */
export class WebhookEvent {
  private props: Required<Pick<WebhookEventProps, 'webhookType' | 'payload' | 'status'>> &
    WebhookEventProps;

  constructor(props: WebhookEventProps) {
    this.validate(props);
    this.props = {
      ...props,
      status: props.status ?? WebhookStatus.RECEIVED,
      createdAt: props.createdAt ?? new Date(),
    };
  }

  private validate(props: WebhookEventProps): void {
    if (!props.webhookType) throw new Error('WebhookEvent: webhookType is required');
    if (!props.payload) throw new Error('WebhookEvent: payload is required');
  }

  // ── Getters ─────────────────────────────────────────────────────

  get id(): string | undefined {
    return this.props.id;
  }
  get webhookType(): WebhookType {
    return this.props.webhookType;
  }
  get payload(): Record<string, unknown> {
    return this.props.payload;
  }
  get siengeDeliveryId(): string | undefined {
    return this.props.siengeDeliveryId;
  }
  get siengeHookId(): string | undefined {
    return this.props.siengeHookId;
  }
  get siengeEvent(): string | undefined {
    return this.props.siengeEvent;
  }
  get siengeTenant(): string | undefined {
    return this.props.siengeTenant;
  }
  get status(): WebhookStatus {
    return this.props.status;
  }
  get processedAt(): Date | undefined {
    return this.props.processedAt;
  }
  get errorMessage(): string | undefined {
    return this.props.errorMessage;
  }
  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  // ── State Transitions ─────────────────────────────────────────

  /**
   * Marks the webhook as being actively processed.
   */
  startProcessing(): void {
    if (this.props.status !== WebhookStatus.RECEIVED) {
      throw new Error(`WebhookEvent: cannot start processing from status '${this.props.status}'`);
    }
    this.props.status = WebhookStatus.PROCESSING;
  }

  /**
   * Marks the webhook as successfully processed.
   */
  markProcessed(): void {
    this.props.status = WebhookStatus.PROCESSED;
    this.props.processedAt = new Date();
    this.props.errorMessage = undefined;
  }

  /**
   * Marks the webhook as failed during processing.
   */
  markFailed(errorMessage: string): void {
    this.props.status = WebhookStatus.FAILED;
    this.props.processedAt = new Date();
    this.props.errorMessage = errorMessage;
  }

  // ── Query Helpers ─────────────────────────────────────────────

  /**
   * Whether this webhook creates a primary order-quotation link.
   * This is the most critical webhook for the system (RN-06, RN-09).
   */
  get isOrderGeneratedWebhook(): boolean {
    return this.props.webhookType === WebhookType.PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION;
  }

  /**
   * Serializes to a plain object suitable for database persistence.
   */
  toRecord(): Record<string, unknown> {
    return {
      id: this.props.id,
      webhook_type: this.props.webhookType,
      payload: this.props.payload,
      sienge_delivery_id: this.props.siengeDeliveryId ?? null,
      sienge_hook_id: this.props.siengeHookId ?? null,
      sienge_event: this.props.siengeEvent ?? null,
      sienge_tenant: this.props.siengeTenant ?? null,
      status: this.props.status,
      processed_at: this.props.processedAt?.toISOString() ?? null,
      error_message: this.props.errorMessage ?? null,
    };
  }
}
