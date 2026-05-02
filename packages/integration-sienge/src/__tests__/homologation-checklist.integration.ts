/**
 * PRD-07 §17 — Homologation Checklist (consolidated runner)
 *
 * Runs all readonly smoke scripts (§17.1, §17.3–17.5, §17.7–17.9) in sequence
 * and produces a unified compliance report. §17.2 (confirmation from Compras)
 * and §17.6 (write mutation) are marked for manual validation.
 *
 * Requires:
 *   - Sienge credentials: SIENGE_BASE_URL, SIENGE_API_KEY, SIENGE_API_SECRET
 *   - Supabase credentials: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   - Optional: HOMOLOG_QUOTATION_ID, HOMOLOG_SUPPLIER_ID (§17.5)
 *   - Optional: HOMOLOG_DELIVERY_REQ_SAMPLES (§17.9)
 *
 * Usage (from monorepo root):
 *   pnpm --filter @projetog/integration-sienge exec tsx src/__tests__/homologation-checklist.integration.ts
 */

import { resolve } from 'node:path';
import { config } from 'dotenv';

const apiEnv = resolve(import.meta.dirname, '../../../../apps/api/.env');
const workersEnv = resolve(import.meta.dirname, '../../../../workers/.env');
config({ path: apiEnv });
config({ path: workersEnv });

const DIVIDER = '═'.repeat(80);
const SECTION_DIV = '─'.repeat(80);

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

type CheckStatus = 'PASS' | 'PARTIAL' | 'SKIP' | 'FAIL' | 'MANUAL';

interface CheckResult {
  section: string;
  status: CheckStatus;
  summary: string;
  details: string[];
}

const results: CheckResult[] = [];

function addResult(section: string, status: CheckStatus, summary: string, details: string[]): void {
  results.push({ section, status, summary, details });
}

// ──────────────────────────────────────────────────────────────────────────────
// §17.1 — Supplier ↔ Creditor Mapping
// ──────────────────────────────────────────────────────────────────────────────

async function check17_1(): Promise<void> {
  console.log(`\n${SECTION_DIV}`);
  console.log('  §17.1 — Supplier ↔ Creditor Mapping');
  console.log(SECTION_DIV);

  try {
    const { createSiengeClient } = await import('../index.js');
    const client = createSiengeClient({
      SIENGE_BASE_URL: process.env.SIENGE_BASE_URL,
      SIENGE_API_KEY: process.env.SIENGE_API_KEY,
      SIENGE_API_SECRET: process.env.SIENGE_API_SECRET,
    });

    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const startDate = sixMonthsAgo.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    interface SupplierEntry { supplierId: number; supplierName: string }
    interface NegotiationResult { purchaseQuotationId: number; suppliers: SupplierEntry[] }
    interface PaginatedResponse<T> { resultSetMetadata: { count: number }; results: T[] }

    const negotiations = await client.get<PaginatedResponse<NegotiationResult>>(
      '/purchase-quotations/all/negotiations',
      { correlationId: 'h17-1-checklist', source: 'unknown' },
      { params: { startDate, endDate, limit: 30 } },
    );

    const seen = new Set<number>();
    const suppliers: { supplierId: number; supplierName: string }[] = [];
    for (const neg of negotiations.results) {
      for (const s of neg.suppliers) {
        if (!seen.has(s.supplierId)) {
          seen.add(s.supplierId);
          suppliers.push({ supplierId: s.supplierId, supplierName: s.supplierName });
        }
      }
    }

    let resolved = 0;
    let withEmail = 0;
    const failures: string[] = [];

    for (const s of suppliers) {
      try {
        interface CreditorContact { email?: string }
        interface CreditorResponse { id: number; name: string; contacts: CreditorContact[] }
        const creditor = await client.get<CreditorResponse>(
          `/creditors/${s.supplierId}`,
          { correlationId: `h17-1-${s.supplierId}`, source: 'unknown' },
        );
        resolved++;
        const email = creditor.contacts?.find((c) => c.email && c.email.trim() !== '');
        if (email) withEmail++;
      } catch {
        failures.push(`supplierId=${s.supplierId} (${s.supplierName})`);
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    const details = [
      `Unique suppliers in sample: ${suppliers.length}`,
      `Resolved as creditor: ${resolved}/${suppliers.length}`,
      `With email in contacts[]: ${withEmail}/${resolved}`,
    ];
    if (failures.length > 0) details.push(`Unresolved: ${failures.join(', ')}`);

    const status: CheckStatus = failures.length === 0 ? 'PASS' : resolved / suppliers.length > 0.8 ? 'PARTIAL' : 'FAIL';
    addResult('§17.1', status, `supplierId ↔ creditorId mapping: ${resolved}/${suppliers.length} resolved`, details);

    console.log(`  Status: ${status}`);
    details.forEach((d) => console.log(`    ${d}`));
  } catch (err: unknown) {
    const e = err as { message: string };
    addResult('§17.1', 'FAIL', `Could not validate: ${e.message}`, []);
    console.log(`  ❌ ${e.message}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// §17.2 — Email Contact Validation (requires Compras confirmation)
// ──────────────────────────────────────────────────────────────────────────────

function check17_2(): void {
  console.log(`\n${SECTION_DIV}`);
  console.log('  §17.2 — Email Contact Validation');
  console.log(SECTION_DIV);

  addResult(
    '§17.2',
    'MANUAL',
    'Requires declarative confirmation from Compras that first contacts[].email = operational contact',
    ['Script evidence from §17.1 shows email availability', 'Pending: formal confirmation from Compras team'],
  );
  console.log('  Status: MANUAL — awaiting Compras team confirmation');
}

// ──────────────────────────────────────────────────────────────────────────────
// §17.3 / §17.4 — Webhook History (readonly Supabase query)
// ──────────────────────────────────────────────────────────────────────────────

async function check17_3_4(): Promise<void> {
  console.log(`\n${SECTION_DIV}`);
  console.log('  §17.3 / §17.4 — Webhook History');
  console.log(SECTION_DIV);

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!base || !key) {
    addResult('§17.3/17.4', 'SKIP', 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set', []);
    console.log('  ⚠️ Supabase credentials not set — skipping');
    return;
  }

  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const isoSince = since.toISOString();

    const params = new URLSearchParams({
      select: 'webhook_type,created_at',
      created_at: `gte.${isoSince}`,
      order: 'created_at.desc',
      limit: '500',
    });

    const url = `${base.replace(/\/$/, '')}/rest/v1/webhook_events?${params.toString()}`;
    const res = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });

    if (!res.ok) {
      addResult('§17.3/17.4', 'FAIL', `Supabase REST error ${res.status}`, []);
      console.log(`  ❌ Supabase error: ${res.status}`);
      return;
    }

    interface WebhookRow { webhook_type: string; created_at: string }
    const rows = (await res.json()) as WebhookRow[];

    const TARGET_TYPES = [
      'PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION',
      'PURCHASE_QUOTATION_NEGOTIATION_AUTHORIZATION_CHANGED',
    ] as const;

    const byType = new Map<string, { count: number; last?: string }>();
    for (const t of TARGET_TYPES) byType.set(t, { count: 0 });

    for (const row of rows) {
      const cur = byType.get(row.webhook_type) ?? { count: 0 };
      cur.count += 1;
      if (!cur.last) cur.last = row.created_at;
      byType.set(row.webhook_type, cur);
    }

    const details: string[] = [`Window: last 30 days (since ${isoSince})`, `Total rows: ${rows.length}`];
    let allPresent = true;

    for (const t of TARGET_TYPES) {
      const s = byType.get(t)!;
      details.push(`  ${t}: count=${s.count}, last=${s.last ?? '—'}`);
      if (s.count === 0) allPresent = false;
    }

    const status: CheckStatus = allPresent ? 'PASS' : rows.length > 0 ? 'PARTIAL' : 'SKIP';
    addResult('§17.3/17.4', status, `Webhook history: ${allPresent ? 'both types received' : 'some types missing'}`, details);

    console.log(`  Status: ${status}`);
    details.forEach((d) => console.log(`    ${d}`));
  } catch (err: unknown) {
    const e = err as { message: string };
    addResult('§17.3/17.4', 'FAIL', `Error: ${e.message}`, []);
    console.log(`  ❌ ${e.message}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// §17.5 — Quotation Map Supplier
// ──────────────────────────────────────────────────────────────────────────────

async function check17_5(): Promise<void> {
  console.log(`\n${SECTION_DIV}`);
  console.log('  §17.5 — Quotation Map Supplier Presence');
  console.log(SECTION_DIV);

  const qid = Number(process.env.HOMOLOG_QUOTATION_ID);
  const sid = Number(process.env.HOMOLOG_SUPPLIER_ID);

  if (!Number.isFinite(qid) || !Number.isFinite(sid)) {
    addResult('§17.5', 'SKIP', 'HOMOLOG_QUOTATION_ID / HOMOLOG_SUPPLIER_ID not set', [
      'Set these env vars and re-run for targeted validation',
    ]);
    console.log('  ⚠️ HOMOLOG_QUOTATION_ID / HOMOLOG_SUPPLIER_ID not set — skipping');
    return;
  }

  try {
    const { createSiengeClient } = await import('../index.js');
    const client = createSiengeClient({
      SIENGE_BASE_URL: process.env.SIENGE_BASE_URL,
      SIENGE_API_KEY: process.env.SIENGE_API_KEY,
      SIENGE_API_SECRET: process.env.SIENGE_API_SECRET,
    });

    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const startDate = sixMonthsAgo.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    interface SupplierEntry { supplierId: number }
    interface NegotiationResult { purchaseQuotationId: number; suppliers: SupplierEntry[] }
    interface PaginatedResponse<T> { resultSetMetadata: { count: number }; results: T[] }

    const negotiations = await client.get<PaginatedResponse<NegotiationResult>>(
      '/purchase-quotations/all/negotiations',
      { correlationId: 'h17-5-checklist', source: 'unknown' },
      { params: { startDate, endDate, limit: 200 } },
    );

    const row = negotiations.results.find((r) => r.purchaseQuotationId === qid);
    if (!row) {
      addResult('§17.5', 'PARTIAL', `Quotation ${qid} not found in ${startDate}..${endDate}`, [
        'Widen date range or confirm quotation ID',
      ]);
      console.log(`  ⚠️ Quotation ${qid} not found in date range`);
      return;
    }

    const ids = row.suppliers.map((s) => s.supplierId);
    const present = ids.includes(sid);

    addResult('§17.5', present ? 'PASS' : 'PARTIAL', `Supplier ${sid} ${present ? 'present' : 'absent'} in map for quotation ${qid}`, [
      `Suppliers in map: ${ids.join(', ')}`,
    ]);
    console.log(`  Status: ${present ? 'PASS' : 'PARTIAL'}`);
    console.log(`    Supplier ${sid} → ${present ? '✅ present' : '❌ absent'}`);
  } catch (err: unknown) {
    const e = err as { message: string };
    addResult('§17.5', 'FAIL', `Error: ${e.message}`, []);
    console.log(`  ❌ ${e.message}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// §17.6 — Write mutation (manual only)
// ──────────────────────────────────────────────────────────────────────────────

function check17_6(): void {
  console.log(`\n${SECTION_DIV}`);
  console.log('  §17.6 — Negotiation Write (POST/PUT/PATCH sequence)');
  console.log(SECTION_DIV);

  addResult(
    '§17.6',
    'MANUAL',
    'Requires real mutation in Sienge — no readonly script',
    [
      'Execute approved write flow in homologation environment',
      'Record quotation/supplier IDs and HTTP results per step',
      'See docs/runbooks/sienge-homologation.md §17.6',
    ],
  );
  console.log('  Status: MANUAL — requires real write session with Compras');
}

// ──────────────────────────────────────────────────────────────────────────────
// §17.7 — Multiple Quotations per Order
// ──────────────────────────────────────────────────────────────────────────────

async function check17_7(): Promise<void> {
  console.log(`\n${SECTION_DIV}`);
  console.log('  §17.7 — Multiple Quotations per Order');
  console.log(SECTION_DIV);

  try {
    const { createSiengeClient, OrderClient } = await import('../index.js');
    const sienge = createSiengeClient({
      SIENGE_BASE_URL: process.env.SIENGE_BASE_URL,
      SIENGE_API_KEY: process.env.SIENGE_API_KEY,
      SIENGE_API_SECRET: process.env.SIENGE_API_SECRET,
    });

    const limit = Number(process.env.HOMOLOG_ORDER_SAMPLE_LIMIT) || 80;
    const orderClient = new OrderClient(sienge);
    const today = new Date();
    const start = new Date(today);
    start.setMonth(start.getMonth() - 6);
    const startDate = start.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    const page = await orderClient.listPaged(
      { startDate, endDate, limit },
      { correlationId: 'h17-7-checklist', source: 'unknown' },
    );

    let single = 0;
    let multi = 0;
    let zero = 0;

    for (const o of page.results) {
      const n = Array.isArray(o.purchaseQuotations) ? o.purchaseQuotations.length : 0;
      if (n === 0) zero++;
      else if (n === 1) single++;
      else multi++;
    }

    const details = [
      `Sample: ${page.results.length} orders (limit=${limit})`,
      `purchaseQuotations.length === 0: ${zero}`,
      `purchaseQuotations.length === 1: ${single}`,
      `purchaseQuotations.length > 1: ${multi}`,
    ];

    const status: CheckStatus = multi > 0 ? 'PASS' : page.results.length > 0 ? 'PARTIAL' : 'SKIP';
    addResult('§17.7', status, `Multi-quotation orders: ${multi > 0 ? `${multi} found` : 'none in sample'}`, details);

    console.log(`  Status: ${status}`);
    details.forEach((d) => console.log(`    ${d}`));
  } catch (err: unknown) {
    const e = err as { message: string };
    addResult('§17.7', 'FAIL', `Error: ${e.message}`, []);
    console.log(`  ❌ ${e.message}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// §17.8 — Deliveries Attended Coverage
// ──────────────────────────────────────────────────────────────────────────────

async function check17_8(): Promise<void> {
  console.log(`\n${SECTION_DIV}`);
  console.log('  §17.8 — Deliveries Attended Coverage');
  console.log(SECTION_DIV);

  const base = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!base || !serviceKey) {
    addResult('§17.8', 'SKIP', 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set', []);
    console.log('  ⚠️ Supabase credentials not set — skipping');
    return;
  }

  try {
    const { createSiengeClient, InvoiceClient } = await import('../index.js');
    const sienge = createSiengeClient({
      SIENGE_BASE_URL: process.env.SIENGE_BASE_URL,
      SIENGE_API_KEY: process.env.SIENGE_API_KEY,
      SIENGE_API_SECRET: process.env.SIENGE_API_SECRET,
    });

    const limit = Number(process.env.HOMOLOG_DELIVERIES_PAGE_LIMIT) || 50;
    const invoiceClient = new InvoiceClient(sienge);

    const page = await invoiceClient.getDeliveriesAttendedPaged(
      { limit, offset: 0 },
      { correlationId: 'h17-8-checklist', source: 'unknown' },
    );

    let matched = 0;
    let missing = 0;

    for (const r of page.results) {
      const params = new URLSearchParams({
        select: 'id',
        invoice_sequential_number: `eq.${r.sequentialNumber}`,
        purchase_order_id: `eq.${r.purchaseOrderId}`,
        invoice_item_number: `eq.${r.invoiceItemNumber}`,
        purchase_order_item_number: `eq.${r.purchaseOrderItemNumber}`,
        limit: '1',
      });

      const url = `${base.replace(/\/$/, '')}/rest/v1/deliveries?${params.toString()}`;
      const res = await fetch(url, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });

      if (res.ok) {
        const rows = (await res.json()) as unknown[];
        if (rows.length > 0) matched++;
        else missing++;
      } else {
        missing++;
      }
    }

    const details = [
      `Sienge deliveries-attended sample: ${page.results.length} (limit=${limit})`,
      `Matched in local DB: ${matched}`,
      `Missing locally: ${missing}`,
    ];

    const status: CheckStatus = missing === 0 && matched > 0 ? 'PASS' : matched > 0 ? 'PARTIAL' : page.results.length === 0 ? 'SKIP' : 'FAIL';
    addResult('§17.8', status, `Deliveries coverage: ${matched}/${page.results.length} matched`, details);

    console.log(`  Status: ${status}`);
    details.forEach((d) => console.log(`    ${d}`));
  } catch (err: unknown) {
    const e = err as { message: string };
    addResult('§17.8', 'FAIL', `Error: ${e.message}`, []);
    console.log(`  ❌ ${e.message}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// §17.9 — openQuantity Type Variations
// ──────────────────────────────────────────────────────────────────────────────

async function check17_9(): Promise<void> {
  console.log(`\n${SECTION_DIV}`);
  console.log('  §17.9 — openQuantity Type Variations');
  console.log(SECTION_DIV);

  const samplesRaw = process.env.HOMOLOG_DELIVERY_REQ_SAMPLES;
  if (!samplesRaw?.trim()) {
    addResult('§17.9', 'SKIP', 'HOMOLOG_DELIVERY_REQ_SAMPLES not set', [
      'Set e.g. HOMOLOG_DELIVERY_REQ_SAMPLES="12345:1,12346:2"',
    ]);
    console.log('  ⚠️ HOMOLOG_DELIVERY_REQ_SAMPLES not set — skipping');
    return;
  }

  try {
    const { createSiengeClient, DeliveryRequirementClient } = await import('../index.js');
    const sienge = createSiengeClient({
      SIENGE_BASE_URL: process.env.SIENGE_BASE_URL,
      SIENGE_API_KEY: process.env.SIENGE_API_KEY,
      SIENGE_API_SECRET: process.env.SIENGE_API_SECRET,
    });

    const client = new DeliveryRequirementClient(sienge);
    const samples: { purchaseRequestId: number; itemNumber: number }[] = [];
    for (const part of samplesRaw.split(',')) {
      const [a, b] = part.trim().split(':');
      const pid = Number(a);
      const inum = Number(b);
      if (Number.isFinite(pid) && Number.isFinite(inum)) {
        samples.push({ purchaseRequestId: pid, itemNumber: inum });
      }
    }

    const hist = new Map<string, number>();
    for (const { purchaseRequestId, itemNumber } of samples) {
      const rows = await client.get(purchaseRequestId, itemNumber, {
        correlationId: 'h17-9-checklist',
        source: 'unknown',
      });
      for (const row of rows) {
        const t = row.openQuantity === null || row.openQuantity === undefined ? 'nullish' : typeof row.openQuantity;
        hist.set(t, (hist.get(t) ?? 0) + 1);
      }
    }

    const details = [`Samples: ${samples.length}`, `Types: ${JSON.stringify(Object.fromEntries(hist))}`];
    const status: CheckStatus = hist.size > 0 ? 'PASS' : 'SKIP';
    addResult('§17.9', status, `openQuantity types: ${JSON.stringify(Object.fromEntries(hist))}`, details);

    console.log(`  Status: ${status}`);
    details.forEach((d) => console.log(`    ${d}`));
  } catch (err: unknown) {
    const e = err as { message: string };
    addResult('§17.9', 'FAIL', `Error: ${e.message}`, []);
    console.log(`  ❌ ${e.message}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Runner
// ──────────────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log(DIVIDER);
  console.log('  PRD-07 §17 — HOMOLOGATION CHECKLIST');
  console.log(`  Generated: ${new Date().toISOString()}`);
  console.log(DIVIDER);

  // Validate minimum credentials
  if (!process.env.SIENGE_BASE_URL || !process.env.SIENGE_API_KEY || !process.env.SIENGE_API_SECRET) {
    console.error('\n❌ Sienge credentials (SIENGE_BASE_URL, SIENGE_API_KEY, SIENGE_API_SECRET) are required.');
    process.exit(1);
  }

  await check17_1();
  check17_2();
  await check17_3_4();
  await check17_5();
  check17_6();
  await check17_7();
  await check17_8();
  await check17_9();

  // ── Final Report ──
  console.log(`\n${DIVIDER}`);
  console.log('  📊 CONSOLIDATED REPORT');
  console.log(DIVIDER);

  const statusEmoji: Record<CheckStatus, string> = {
    PASS: '✅',
    PARTIAL: '⚠️',
    SKIP: '⏭️',
    FAIL: '❌',
    MANUAL: '🔧',
  };

  for (const r of results) {
    console.log(`\n  ${statusEmoji[r.status]} ${r.section} [${r.status}]`);
    console.log(`     ${r.summary}`);
    for (const d of r.details) {
      console.log(`       ${d}`);
    }
  }

  console.log(`\n${SECTION_DIV}`);

  const counts = { PASS: 0, PARTIAL: 0, SKIP: 0, FAIL: 0, MANUAL: 0 };
  for (const r of results) counts[r.status]++;

  console.log('\n  Summary:');
  console.log(`    ✅ PASS:    ${counts.PASS}`);
  console.log(`    ⚠️  PARTIAL: ${counts.PARTIAL}`);
  console.log(`    ⏭️  SKIP:    ${counts.SKIP}`);
  console.log(`    ❌ FAIL:    ${counts.FAIL}`);
  console.log(`    🔧 MANUAL:  ${counts.MANUAL}`);
  console.log(`    Total:      ${results.length}`);

  console.log(`\n${DIVIDER}`);

  if (counts.FAIL > 0) {
    console.log('\n  ❌ HOMOLOGATION HAS FAILURES — review and re-run after fixes.');
    process.exit(1);
  } else if (counts.MANUAL > 0 || counts.SKIP > 0) {
    console.log('\n  ⚠️ HOMOLOGATION INCOMPLETE — manual items or skipped checks remain.');
    console.log('     See docs/runbooks/sienge-homologation.md for next steps.');
  } else {
    console.log('\n  ✅ ALL AUTOMATED CHECKS PASSED.');
  }

  console.log(DIVIDER);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
