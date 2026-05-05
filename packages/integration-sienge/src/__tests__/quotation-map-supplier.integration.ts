/**
 * PRD §17.5 — Fornecedor presente no mapa da cotação (somente leitura Sienge).
 *
 * Variáveis:
 *   HOMOLOG_QUOTATION_ID — purchaseQuotationId numérico
 *   HOMOLOG_SUPPLIER_ID — supplierId numérico esperado no mapa
 *
 * Uso (raiz): HOMOLOG_QUOTATION_ID=123 HOMOLOG_SUPPLIER_ID=456 pnpm --filter @projetog/integration-sienge exec tsx src/__tests__/quotation-map-supplier.integration.ts
 */

import { resolve } from 'node:path';
import { config } from 'dotenv';
import { createSiengeClient } from '../index.js';

const envPath = resolve(import.meta.dirname, '../../../../apps/api/.env');
config({ path: envPath });

const DIVIDER = '─'.repeat(70);

interface SupplierEntry {
  supplierId: number;
  supplierName?: string;
}

interface NegotiationResult {
  purchaseQuotationId: number;
  suppliers: SupplierEntry[];
}

interface PaginatedResponse<T> {
  resultSetMetadata: { count: number };
  results: T[];
}

async function run(): Promise<void> {
  const qid = Number(process.env.HOMOLOG_QUOTATION_ID);
  const sid = Number(process.env.HOMOLOG_SUPPLIER_ID);

  console.log(DIVIDER);
  console.log('🗺️ Quotation map supplier — §17.5');
  console.log(DIVIDER);

  if (!Number.isFinite(qid) || !Number.isFinite(sid)) {
    console.error('❌ Defina HOMOLOG_QUOTATION_ID e HOMOLOG_SUPPLIER_ID (números).');
    process.exit(1);
  }

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

  const negotiations = await client.get<PaginatedResponse<NegotiationResult>>(
    '/purchase-quotations/all/negotiations',
    { correlationId: 'h17-5', source: 'unknown' },
    { params: { startDate, endDate, limit: 200 } },
  );

  const row = negotiations.results.find((r) => r.purchaseQuotationId === qid);
  if (!row) {
    console.log(`\n⚠️ Cotação ${qid} não encontrada no recorte ${startDate}..${endDate}.`);
    console.log('   Amplie datas ou confirme número da cotação.');
    process.exit(0);
  }

  const ids = row.suppliers.map((s) => s.supplierId);
  const present = ids.includes(sid);

  console.log(`\nCotação ${qid}: ${row.suppliers.length} fornecedor(es) no mapa.`);
  console.log(`supplierIds: ${ids.join(', ') || '—'}`);
  console.log(
    `\nHOMOLOG_SUPPLIER_ID=${sid} → ${present ? '✅ presente no mapa' : '❌ ausente do mapa'}`,
  );
  console.log(DIVIDER);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
