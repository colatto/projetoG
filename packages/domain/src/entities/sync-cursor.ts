import { SyncResourceType, SyncStatus } from '../enums/index.js';

export interface SyncCursorProps {
  id?: string;
  resourceType: SyncResourceType;
  lastOffset?: number;
  lastSyncedAt?: Date;
  requiresFullSync?: boolean;
  syncStatus?: SyncStatus;
  errorMessage?: string;
  updatedAt?: Date;
}

/**
 * Domain entity for sync cursor management.
 * Tracks the pagination offset and status for each resource type
 * being synchronized from Sienge.
 *
 * PRD-07 §4.4
 */
export class SyncCursor {
  private props: Required<
    Pick<SyncCursorProps, 'resourceType' | 'lastOffset' | 'syncStatus' | 'requiresFullSync'>
  > &
    SyncCursorProps;

  constructor(props: SyncCursorProps) {
    this.validate(props);
    this.props = {
      ...props,
      lastOffset: props.lastOffset ?? 0,
      syncStatus: props.syncStatus ?? SyncStatus.IDLE,
      lastSyncedAt: props.lastSyncedAt ?? new Date(0),
      requiresFullSync: props.requiresFullSync ?? false,
    };
  }

  private validate(props: SyncCursorProps): void {
    if (!props.resourceType) throw new Error('SyncCursor: resourceType is required');
  }

  // ── Getters ─────────────────────────────────────────────────────

  get id(): string | undefined {
    return this.props.id;
  }
  get resourceType(): SyncResourceType {
    return this.props.resourceType;
  }
  get lastOffset(): number {
    return this.props.lastOffset;
  }
  get lastSyncedAt(): Date | undefined {
    return this.props.lastSyncedAt;
  }
  get requiresFullSync(): boolean {
    return this.props.requiresFullSync;
  }
  get syncStatus(): SyncStatus {
    return this.props.syncStatus;
  }
  get errorMessage(): string | undefined {
    return this.props.errorMessage;
  }
  get updatedAt(): Date | undefined {
    return this.props.updatedAt;
  }

  // ── State Transitions ─────────────────────────────────────────

  /**
   * Marks the sync as started/running.
   * Prevents concurrent syncs of the same resource type.
   */
  startSync(): void {
    if (this.props.syncStatus === SyncStatus.RUNNING) {
      throw new Error(`SyncCursor: sync for '${this.props.resourceType}' is already running`);
    }
    this.props.syncStatus = SyncStatus.RUNNING;
    this.props.errorMessage = undefined;
  }

  /**
   * Advances the cursor position after a successful page sync.
   */
  advanceOffset(newOffset: number): void {
    this.props.lastOffset = newOffset;
  }

  /**
   * Marks the sync as completed successfully.
   */
  completeSync(): void {
    this.props.syncStatus = SyncStatus.IDLE;
    this.props.lastSyncedAt = new Date();
    this.props.errorMessage = undefined;
  }

  /**
   * Marks the sync as failed with an error message.
   * The offset is NOT advanced so the next run retries from the same position.
   */
  failSync(errorMessage: string): void {
    this.props.syncStatus = SyncStatus.ERROR;
    this.props.errorMessage = errorMessage;
  }

  /**
   * Resets the cursor to start from the beginning.
   * Useful for full resynchronization.
   */
  resetToBeginning(): void {
    this.props.lastOffset = 0;
    this.props.syncStatus = SyncStatus.IDLE;
    this.props.lastSyncedAt = new Date(0);
    this.props.errorMessage = undefined;
    this.props.requiresFullSync = false;
  }

  // ── Query Helpers ─────────────────────────────────────────────

  get isRunning(): boolean {
    return this.props.syncStatus === SyncStatus.RUNNING;
  }

  get hasError(): boolean {
    return this.props.syncStatus === SyncStatus.ERROR;
  }

  /**
   * Serializes to a plain object suitable for database persistence.
   */
  toRecord(): Record<string, unknown> {
    return {
      id: this.props.id,
      resource_type: this.props.resourceType,
      last_offset: this.props.lastOffset,
      last_synced_at: this.props.lastSyncedAt?.toISOString(),
      requires_full_sync: this.props.requiresFullSync,
      sync_status: this.props.syncStatus,
      error_message: this.props.errorMessage ?? null,
    };
  }
}
