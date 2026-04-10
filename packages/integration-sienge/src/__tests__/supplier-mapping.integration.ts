/**
 * V5 Validation — supplierId ↔ creditorId Mapping
 *
 * Validates PRDGlobal §17 items 1 and 2:
 * 1. Whether supplierId from purchase quotations corresponds to creditorId
 * 2. Whether the rule of using the first contacts[].email is sufficient
 *
 * Discovered: suppliers[] is a nested array inside each quotation result.
 *
 * Usage: pnpm --filter @projetog/integration-sienge exec tsx src/__tests__/supplier-mapping.integration.ts
 */

import { resolve } from 'node:path';
import { config } from 'dotenv';
import { createSiengeClient } from '../index.js';

const envPath = resolve(import.meta.dirname, '../../../../apps/api/.env');
config({ path: envPath });

const DIVIDER = '─'.repeat(70);

interface CreditorContact {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
}

interface CreditorResponse {
  id: number;
  name: string;
  tradeName?: string;
  cnpj?: string;
  cpf?: string;
  supplier: boolean;
  active: boolean;
  contacts: CreditorContact[];
}

interface SupplierEntry {
  supplierId: number;
  supplierName: string;
  latestNegotiation?: Record<string, unknown>;
}

interface NegotiationResult {
  purchaseQuotationId: number;
  suppliers: SupplierEntry[];
  [key: string]: unknown;
}

interface PaginatedResponse<T> {
  resultSetMetadata: { count: number; offset: number; limit: number };
  results: T[];
}

interface ValidationResult {
  supplierId: number;
  supplierName: string;
  found: boolean;
  creditorName?: string;
  isSupplier?: boolean;
  isActive?: boolean;
  contactCount: number;
  hasEmail: boolean;
  firstEmail?: string;
  error?: string;
}

async function run(): Promise<void> {
  console.log(DIVIDER);
  console.log('🔍 V5 — Validação supplierId ↔ creditorId');
  console.log(DIVIDER);

  const client = createSiengeClient({
    SIENGE_BASE_URL: process.env.SIENGE_BASE_URL,
    SIENGE_API_KEY: process.env.SIENGE_API_KEY,
    SIENGE_API_SECRET: process.env.SIENGE_API_SECRET,
  });

  // ── Step 1: Fetch supplierIds from quotation negotiations ──
  console.log('\n📋 Step 1: Fetching supplierIds from quotation negotiations...');

  const today = new Date();
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const startDate = sixMonthsAgo.toISOString().split('T')[0];
  const endDate = today.toISOString().split('T')[0];

  let supplierEntries: { supplierId: number; supplierName: string }[] = [];

  try {
    const negotiations = await client.get<PaginatedResponse<NegotiationResult>>(
      '/purchase-quotations/all/negotiations',
      { correlationId: 'v5-fetch', source: 'unknown' },
      { params: { startDate, endDate, limit: 30 } }
    );

    console.log(`   ✅ Found ${negotiations.resultSetMetadata.count} negotiations`);

    // Extract unique supplierIds from the nested suppliers[] array
    const seen = new Set<number>();
    for (const negotiation of negotiations.results) {
      for (const supplier of negotiation.suppliers) {
        if (!seen.has(supplier.supplierId)) {
          seen.add(supplier.supplierId);
          supplierEntries.push({
            supplierId: supplier.supplierId,
            supplierName: supplier.supplierName,
          });
        }
      }
    }

    console.log(`   Unique supplierIds extracted: ${supplierEntries.length}`);
    console.log(`   IDs: ${supplierEntries.map(s => s.supplierId).join(', ')}`);
  } catch (error: unknown) {
    const err = error as { response?: { status?: number }; message: string };
    console.error(`   ❌ Failed to fetch negotiations: ${err.response?.status} — ${err.message}`);
    process.exit(1);
  }

  if (supplierEntries.length === 0) {
    console.error('\n❌ No suppliers found in negotiations. Aborting.');
    process.exit(1);
  }

  // ── Step 2: Cross-reference supplierId with GET /creditors/{id} ──
  console.log(`\n📋 Step 2: Testing ${supplierEntries.length} supplierIds against GET /creditors/{id}...`);

  const results: ValidationResult[] = [];

  for (const entry of supplierEntries) {
    try {
      const creditor = await client.get<CreditorResponse>(
        `/creditors/${entry.supplierId}`,
        { correlationId: `v5-${entry.supplierId}`, source: 'unknown' }
      );

      const emailContact = creditor.contacts?.find(
        (c: CreditorContact) => c.email && typeof c.email === 'string' && c.email.trim() !== ''
      );

      results.push({
        supplierId: entry.supplierId,
        supplierName: entry.supplierName,
        found: true,
        creditorName: creditor.name,
        isSupplier: creditor.supplier,
        isActive: creditor.active,
        contactCount: creditor.contacts?.length ?? 0,
        hasEmail: !!emailContact,
        firstEmail: emailContact?.email,
      });
    } catch (error: unknown) {
      const err = error as { response?: { status?: number }; message: string };
      results.push({
        supplierId: entry.supplierId,
        supplierName: entry.supplierName,
        found: false,
        contactCount: 0,
        hasEmail: false,
        error: `${err.response?.status ?? 'network'}: ${err.message}`,
      });
    }

    // Respect rate limits
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  // ── Step 3: Report ──
  console.log(`\n${DIVIDER}`);
  console.log('📊 RESULTS — supplierId → GET /creditors/{supplierId}');
  console.log(DIVIDER);

  const found = results.filter(r => r.found);
  const notFound = results.filter(r => !r.found);
  const withEmail = found.filter(r => r.hasEmail);
  const withoutEmail = found.filter(r => !r.hasEmail);
  const nameMatch = found.filter(r => {
    const a = (r.supplierName ?? '').toUpperCase().trim();
    const b = (r.creditorName ?? '').toUpperCase().trim();
    return a === b;
  });

  for (const r of results) {
    const status = r.found ? '✅' : '❌';
    const email = r.hasEmail ? `📧 ${r.firstEmail}` : '📧 —';
    const nameCheck = r.found
      ? (r.supplierName?.toUpperCase().trim() === r.creditorName?.toUpperCase().trim() ? '🔗 name match' : `🔗 name differs: "${r.creditorName}"`)
      : '';

    console.log(`\n   ${status} supplierId=${r.supplierId}`);
    console.log(`      Quotation name: ${r.supplierName}`);
    if (r.found) {
      console.log(`      Creditor name:  ${r.creditorName}`);
      console.log(`      supplier flag: ${r.isSupplier} | active: ${r.isActive} | contacts: ${r.contactCount}`);
      console.log(`      ${email}`);
      console.log(`      ${nameCheck}`);
    } else {
      console.log(`      Error: ${r.error}`);
    }
  }

  // ── Summary ──
  console.log(`\n${DIVIDER}`);
  console.log('📝 SUMMARY');
  console.log(DIVIDER);

  console.log(`\n   Total supplierIds tested:      ${results.length}`);
  console.log(`   Resolved as creditor:          ${found.length}/${results.length} (${Math.round(found.length / results.length * 100)}%)`);
  console.log(`   NOT found:                     ${notFound.length}/${results.length}`);
  console.log(`   Name match (exact):            ${nameMatch.length}/${found.length}`);
  console.log(`   With email in contacts[]:      ${withEmail.length}/${found.length}`);
  console.log(`   Without email:                 ${withoutEmail.length}/${found.length}`);

  // ── Verdicts ──
  console.log(`\n${DIVIDER}`);
  console.log('🏁 VERDICTS');
  console.log(DIVIDER);

  console.log('\n   ── PRDGlobal §17 Item 1: supplierId ↔ creditorId ──');
  if (notFound.length === 0) {
    console.log('   ✅ CONFIRMED: supplierId === creditorId');
    console.log('      All supplierIds from quotations resolve to valid creditors.');
    console.log('      The mapping is direct — no intermediate table needed.');
  } else if (notFound.length < results.length * 0.2) {
    console.log(`   ⚠️ MOSTLY CONFIRMED: ${found.length}/${results.length} resolved (${Math.round(found.length / results.length * 100)}%)`);
    console.log(`      ${notFound.length} ID(s) did not resolve: ${notFound.map(r => r.supplierId).join(', ')}`);
    console.log('      These may be inactive/deleted creditors.');
  } else {
    console.log('   ❌ REJECTED: supplierId does NOT reliably map to creditorId.');
    console.log(`      Only ${found.length}/${results.length} resolved.`);
  }

  console.log('\n   ── PRDGlobal §17 Item 2: contacts[].email sufficiency ──');
  if (found.length === 0) {
    console.log('   ⚠️ No creditors resolved — cannot evaluate email rule.');
  } else if (withoutEmail.length === 0) {
    console.log('   ✅ All tested creditors have at least one email in contacts[].');
    console.log('      The "first contacts[].email" rule is sufficient for the tested sample.');
  } else {
    const pct = Math.round(withoutEmail.length / found.length * 100);
    console.log(`   ⚠️ ${withoutEmail.length}/${found.length} creditors (${pct}%) have NO email in contacts[].`);
    console.log('      Per PRDGlobal §9.5, these suppliers would be blocked.');
    console.log('      Affected:');
    for (const r of withoutEmail) {
      console.log(`        - ID ${r.supplierId}: ${r.supplierName} (${r.contactCount} contacts, none with email)`);
    }
    console.log('\n      The system MUST implement the blocking/fallback mechanism from §9.5.');
  }

  // ── Structural finding ──
  console.log('\n   ── Additional finding: API response structure ──');
  console.log('   ⚠️ suppliers[] is a NESTED ARRAY inside each quotation result.');
  console.log('      A single quotation can have multiple suppliers.');
  console.log('      The supplierId is at result.suppliers[].supplierId, NOT at result.supplierId.');
  console.log('      This affects the data extraction logic in the integration module.');

  console.log(`\n${DIVIDER}`);
}

run().catch((error: unknown) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
