/**
 * PRD §17.8 — deliveries-attended vs registros locais em `deliveries` (somente leitura).
 *
 * Compara uma página da API Sienge com Supabase (service role).
 *
 * Requer: credenciais Sienge + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * Opcional: HOMOLOG_DELIVERIES_PAGE_LIMIT (default 50)
 *
 * Uso (raiz): pnpm --filter @projetog/integration-sienge exec tsx src/__tests__/deliveries-attended-coverage.integration.ts
 */

import { resolve } from 'node:path';
import { config } from 'dotenv';
import { createSiengeClient, InvoiceClient } from '../index.js';
import type { SiengeDeliveryAttended } from '../types/sienge-types.js';

const apiEnv = resolve(import.meta.dirname, '../../../../apps/api/.env');
const workersEnv = resolve(import.meta.dirname, '../../../../workers/.env');
config({ path: apiEnv });
config({ path: workersEnv });

const DIVIDER = '─'.repeat(70);

function deliveryKey(r: SiengeDeliveryAttended): string {
  return [
    r.sequentialNumber,
    r.purchaseOrderId,
    r.invoiceItemNumber,
    r.purchaseOrderItemNumber,
  ].join(':');
}

async function fetchLocalDeliveryExists(keyParts: {
  sequential: number;
  poId: number;
  invItem: number;
  poItem: number;
}): Promise<boolean> {
  const base = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !serviceKey) {
    console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes.');
    process.exit(1);
  }

  const params = new URLSearchParams({
    select: 'id',
    invoice_sequential_number: `eq.${keyParts.sequential}`,
    purchase_order_id: `eq.${keyParts.poId}`,
    invoice_item_number: `eq.${keyParts.invItem}`,
    purchase_order_item_number: `eq.${keyParts.poItem}`,
    limit: '1',
  });

  const url = `${base.replace(/\/$/, '')}/rest/v1/deliveries?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  if (!res.ok) {
    console.error(`❌ Supabase: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const rows = (await res.json()) as unknown[];
  return rows.length > 0;
}

async function run(): Promise<void> {
  console.log(DIVIDER);
  console.log('🚚 deliveries-attended coverage — §17.8');
  console.log(DIVIDER);

  const limit = Number(process.env.HOMOLOG_DELIVERIES_PAGE_LIMIT) || 50;

  const sienge = createSiengeClient({
    SIENGE_BASE_URL: process.env.SIENGE_BASE_URL,
    SIENGE_API_KEY: process.env.SIENGE_API_KEY,
    SIENGE_API_SECRET: process.env.SIENGE_API_SECRET,
  });

  const invoiceClient = new InvoiceClient(sienge);
  const page = await invoiceClient.getDeliveriesAttendedPaged(
    { limit, offset: 0 },
    { correlationId: 'h17-8', source: 'unknown' },
  );

  const rows = page.results;
  console.log(`\nAPI Sienge: ${rows.length} linhas (limit=${limit}).`);

  let matched = 0;
  let missingLocal = 0;

  for (const r of rows) {
    const exists = await fetchLocalDeliveryExists({
      sequential: r.sequentialNumber,
      poId: r.purchaseOrderId,
      invItem: r.invoiceItemNumber,
      poItem: r.purchaseOrderItemNumber,
    });
    if (exists) matched += 1;
    else {
      missingLocal += 1;
      if (missingLocal <= 5) {
        console.log(`   Órfão local (exemplo): ${deliveryKey(r)}`);
      }
    }
  }

  console.log(`\nCom correspondência em public.deliveries: ${matched}`);
  console.log(`Sem correspondência local (sync pendente ou legado): ${missingLocal}`);
  console.log(
    '\nInterpretação: órfãos são esperados até o worker sincronizar; tendência alta persistente merece investigação.',
  );
  console.log(DIVIDER);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
