/**
 * PRD §17.7 — Pedidos com múltiplas cotações em purchaseQuotations[] (somente leitura).
 *
 * Opcional: HOMOLOG_ORDER_SAMPLE_LIMIT (default 80)
 *
 * Uso (raiz): pnpm --filter @projetog/integration-sienge exec tsx src/__tests__/multi-quotation-orders.integration.ts
 */

import { resolve } from 'node:path';
import { config } from 'dotenv';
import { createSiengeClient, OrderClient } from '../index.js';

const envPath = resolve(import.meta.dirname, '../../../../apps/api/.env');
config({ path: envPath });

const DIVIDER = '─'.repeat(70);

async function run(): Promise<void> {
  console.log(DIVIDER);
  console.log('📊 Multi-quotation orders — §17.7');
  console.log(DIVIDER);

  const limit = Number(process.env.HOMOLOG_ORDER_SAMPLE_LIMIT) || 80;

  const sienge = createSiengeClient({
    SIENGE_BASE_URL: process.env.SIENGE_BASE_URL,
    SIENGE_API_KEY: process.env.SIENGE_API_KEY,
    SIENGE_API_SECRET: process.env.SIENGE_API_SECRET,
  });

  const orderClient = new OrderClient(sienge);
  const today = new Date();
  const start = new Date(today);
  start.setMonth(start.getMonth() - 6);
  const startDate = start.toISOString().split('T')[0];
  const endDate = today.toISOString().split('T')[0];

  const page = await orderClient.listPaged(
    { startDate, endDate, limit },
    { correlationId: 'h17-7', source: 'unknown' },
  );

  let single = 0;
  let multi = 0;
  let zero = 0;

  for (const o of page.results) {
    const n = Array.isArray(o.purchaseQuotations) ? o.purchaseQuotations.length : 0;
    if (n === 0) zero += 1;
    else if (n === 1) single += 1;
    else multi += 1;
  }

  console.log(`\nAmostra: ${page.results.length} pedidos (limit=${limit}, offset na primeira página).`);
  console.log(`  purchaseQuotations.length === 0 → ${zero}`);
  console.log(`  purchaseQuotations.length === 1 → ${single}`);
  console.log(`  purchaseQuotations.length > 1  → ${multi}`);

  if (multi > 0) {
    console.log('\n✅ Existem pedidos com >1 cotação vinculada na amostra — útil para validar divergência de vínculo.');
  } else {
    console.log('\n⚠️ Nenhum pedido com >1 cotação nesta página — ampliar janela ou offset.');
  }

  console.log(DIVIDER);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
