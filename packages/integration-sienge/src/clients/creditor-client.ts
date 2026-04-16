import { SiengeClient, RequestContext } from '../client.js';
import type { SiengePaginatedResponse, SiengeCreditor } from '../types/sienge-types.js';

export interface ListCreditorsFilters {
  cpf?: string;
  cnpj?: string;
  creditor?: string;
}

/**
 * Client for Sienge Creditor endpoints.
 * PRD-07 §7.1 — `/creditors` and `/creditors/{creditorId}`
 */
export class CreditorClient {
  constructor(private readonly client: SiengeClient) {}

  /**
   * Gets a single creditor by ID.
   * Endpoint: GET /creditors/{creditorId}
   */
  async getById(creditorId: number, context?: RequestContext): Promise<SiengeCreditor> {
    return this.client.get<SiengeCreditor>(`/creditors/${creditorId}`, context);
  }

  /**
   * Lists creditors with automatic pagination.
   * Endpoint: GET /creditors
   */
  async list(
    filters: ListCreditorsFilters = {},
    context?: RequestContext,
  ): Promise<SiengeCreditor[]> {
    return this.client.paginateAll<SiengeCreditor>(
      '/creditors',
      filters as Record<string, unknown>,
      context,
    );
  }

  /**
   * Lists a single page of creditors.
   */
  async listPaged(
    filters: ListCreditorsFilters & { limit?: number; offset?: number } = {},
    context?: RequestContext,
  ): Promise<SiengePaginatedResponse<SiengeCreditor>> {
    const { limit = 100, offset = 0, ...restFilters } = filters;
    return this.client.get<SiengePaginatedResponse<SiengeCreditor>>('/creditors', context, {
      params: { ...restFilters, limit, offset },
    });
  }

  /**
   * Extracts the first non-empty email from a creditor's contacts list (RN-05).
   * Returns null if no email is found — the caller must block the supplier.
   */
  extractPrimaryEmail(creditor: SiengeCreditor): string | null {
    if (!creditor.contacts || creditor.contacts.length === 0) {
      return null;
    }

    for (const contact of creditor.contacts) {
      if (contact.email && contact.email.trim().length > 0) {
        return contact.email.trim();
      }
    }

    return null;
  }
}
