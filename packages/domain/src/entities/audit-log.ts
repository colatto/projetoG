export interface AuditLogProps {
  id: string;
  eventType: string;
  actorId?: string;
  targetUserId?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
  createdAt?: Date;
}

export class AuditLog {
  private props: AuditLogProps;

  constructor(props: AuditLogProps) {
    this.validate(props);
    this.props = {
      ...props,
      createdAt: props.createdAt ?? new Date(),
    };
  }

  private validate(props: AuditLogProps) {
    if (!props.id) throw new Error('AuditLog ID is required');
    if (!props.eventType) throw new Error('AuditLog eventType is required');
  }

  get id(): string {
    return this.props.id;
  }
  get eventType(): string {
    return this.props.eventType;
  }
  get actorId(): string | undefined {
    return this.props.actorId;
  }
  get targetUserId(): string | undefined {
    return this.props.targetUserId;
  }
  get metadata(): Record<string, string | number | boolean | null | undefined> | undefined {
    return this.props.metadata;
  }
  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }
}
