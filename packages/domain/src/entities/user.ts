import { UserRole, UserStatus } from '../enums/index.js';

export interface UserProps {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  name: string;
  supplierId?: number;
  originalEmail?: string;
  createdBy?: string;
  blockedBy?: string;
  blockedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class User {
  private props: UserProps;

  constructor(props: UserProps) {
    this.validate(props);
    this.props = {
      ...props,
      status: props.status ?? UserStatus.PENDENTE,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };
  }

  private validate(props: UserProps) {
    if (!props.id) throw new Error('User ID is required');
    if (!props.email) throw new Error('User email is required');
    if (!props.role) throw new Error('User role is required');
    if (!props.name) throw new Error('User name is required');
    
    if (props.role === UserRole.FORNECEDOR && !props.supplierId) {
      throw new Error('Supplier ID is required for Fornecedor role');
    }
  }

  get id(): string { return this.props.id; }
  get email(): string { return this.props.email; }
  get role(): UserRole { return this.props.role; }
  get status(): UserStatus { return this.props.status; }
  get name(): string { return this.props.name; }
  get supplierId(): number | undefined { return this.props.supplierId; }
  get originalEmail(): string | undefined { return this.props.originalEmail; }
  get createdBy(): string | undefined { return this.props.createdBy; }
  get blockedBy(): string | undefined { return this.props.blockedBy; }
  get blockedAt(): Date | undefined { return this.props.blockedAt; }
  get createdAt(): Date | undefined { return this.props.createdAt; }
  get updatedAt(): Date | undefined { return this.props.updatedAt; }

  public block(adminId: string) {
    this.props.status = UserStatus.BLOQUEADO;
    this.props.blockedAt = new Date();
    this.props.blockedBy = adminId;
    this.props.updatedAt = new Date();
  }

  public reactivate() {
    this.props.status = UserStatus.ATIVO;
    this.props.blockedAt = undefined;
    this.props.blockedBy = undefined;
    this.props.updatedAt = new Date();
  }

  public updateEmail(newEmail: string) {
    if (this.props.role !== UserRole.FORNECEDOR) {
      throw new Error('Cannot update local email for internal users');
    }
    if (!this.props.originalEmail) {
      this.props.originalEmail = this.props.email;
    }
    this.props.email = newEmail;
    this.props.updatedAt = new Date();
  }
}
