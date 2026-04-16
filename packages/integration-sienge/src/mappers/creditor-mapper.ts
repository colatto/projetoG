import type { SiengeCreditor } from '../types/sienge-types.js';

// ── Local domain shapes ─────────────────────────────────────────

export interface LocalSupplier {
  id: number;
  creditorId: number | null;
  name: string;
  tradeName: string | null;
  accessStatus: string | null;
}

export interface LocalSupplierContact {
  supplierId: number;
  name: string;
  email: string;
  isPrimary: boolean;
}

export interface CreditorEmailResult {
  email: string | null;
  allContacts: Array<{ name: string; email: string | null }>;
  hasValidEmail: boolean;
}

// ── Mappers ─────────────────────────────────────────────────────

/**
 * Maps a Sienge creditor to the local `suppliers` entity.
 *
 * The `supplierId` is provided externally because the creditorId in the
 * Sienge creditors API may differ from the supplierId used in purchase
 * quotation contexts (pending homologation — §17.1).
 */
export function mapCreditorToSupplier(creditor: SiengeCreditor, supplierId: number): LocalSupplier {
  return {
    id: supplierId,
    creditorId: creditor.creditorId,
    name: creditor.creditorName,
    tradeName: creditor.tradeName ?? null,
    accessStatus: null, // Determined by email extraction result
  };
}

/**
 * Extracts contacts from a Sienge creditor for the local `supplier_contacts` entity.
 * Only contacts with a non-empty email are included.
 */
export function mapCreditorContacts(
  creditor: SiengeCreditor,
  supplierId: number,
): LocalSupplierContact[] {
  if (!creditor.contacts || creditor.contacts.length === 0) {
    return [];
  }

  const contacts: LocalSupplierContact[] = [];
  let isFirst = true;

  for (const contact of creditor.contacts) {
    if (contact.email && contact.email.trim().length > 0) {
      contacts.push({
        supplierId,
        name: contact.name || creditor.creditorName,
        email: contact.email.trim(),
        isPrimary: isFirst,
      });
      isFirst = false;
    }
  }

  return contacts;
}

/**
 * Extracts the primary email from a Sienge creditor (RN-05).
 *
 * Returns the first non-empty `contacts[].email`. If none exists,
 * the supplier must be blocked until manual adjustment by the Administrator.
 *
 * Anti-pattern avoided: Do NOT treat `contacts[]` as if it always has a single email (§9.11).
 */
export function extractCreditorEmail(creditor: SiengeCreditor): CreditorEmailResult {
  const allContacts = (creditor.contacts ?? []).map((c) => ({
    name: c.name,
    email: c.email ?? null,
  }));

  const firstEmail = allContacts.find((c) => c.email && c.email.trim().length > 0);

  return {
    email: firstEmail?.email?.trim() ?? null,
    allContacts,
    hasValidEmail: firstEmail !== undefined,
  };
}
