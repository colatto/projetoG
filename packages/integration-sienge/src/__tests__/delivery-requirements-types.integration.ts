/**
 * PRD §17.9 — Tipo de `openQuantity` em delivery-requirements (somente leitura).
 *
 * HOMOLOG_DELIVERY_REQ_SAMPLES — lista "purchaseRequestId:itemNumber" separada por vírgula.
 * Ex.: HOMOLOG_DELIVERY_REQ_SAMPLES="1001:1,1002:3"
 *
 * Uso (raiz): HOMOLOG_DELIVERY_REQ_SAMPLES="1:1" pnpm --filter @projetog/integration-sienge exec tsx src/__tests__/delivery-requirements-types.integration.ts
 */

import { resolve } from 'node:path';
import { config } from 'dotenv';
import { createSiengeClient, DeliveryRequirementClient } from '../index.js';

const envPath = resolve(import.meta.dirname, '../../../../apps/api/.env');
config({ path: envPath });

const DIVIDER = '─'.repeat(70);

function parseSamples(
  raw: string | undefined,
): { purchaseRequestId: number; itemNumber: number }[] {
  if (!raw?.trim()) return [];
  const out: { purchaseRequestId: number; itemNumber: number }[] = [];
  for (const part of raw.split(',')) {
    const [a, b] = part.trim().split(':');
    const purchaseRequestId = Number(a);
    const itemNumber = Number(b);
    if (Number.isFinite(purchaseRequestId) && Number.isFinite(itemNumber)) {
      out.push({ purchaseRequestId, itemNumber });
    }
  }
  return out;
}

async function run(): Promise<void> {
  console.log(DIVIDER);
  console.log('📐 delivery-requirements openQuantity types — §17.9');
  console.log(DIVIDER);

  const samples = parseSamples(process.env.HOMOLOG_DELIVERY_REQ_SAMPLES);
  if (samples.length === 0) {
    console.error(
      '❌ Defina HOMOLOG_DELIVERY_REQ_SAMPLES, ex.: HOMOLOG_DELIVERY_REQ_SAMPLES="12345:1"',
    );
    process.exit(1);
  }

  const sienge = createSiengeClient({
    SIENGE_BASE_URL: process.env.SIENGE_BASE_URL,
    SIENGE_API_KEY: process.env.SIENGE_API_KEY,
    SIENGE_API_SECRET: process.env.SIENGE_API_SECRET,
  });

  const client = new DeliveryRequirementClient(sienge);
  const hist = new Map<string, number>();

  for (const { purchaseRequestId, itemNumber } of samples) {
    const rows = await client.get(purchaseRequestId, itemNumber, {
      correlationId: 'h17-9',
      source: 'unknown',
    });

    for (const row of rows) {
      const t =
        row.openQuantity === null || row.openQuantity === undefined
          ? 'nullish'
          : typeof row.openQuantity;
      hist.set(t, (hist.get(t) ?? 0) + 1);
      console.log(
        `\n  PR ${purchaseRequestId} item ${itemNumber}: openQuantity type=${t} value=${JSON.stringify(row.openQuantity)}`,
      );
    }

    if (rows.length === 0) {
      console.log(`\n  PR ${purchaseRequestId} item ${itemNumber}: (sem linhas retornadas)`);
    }
  }

  console.log(`\n${DIVIDER}`);
  console.log('Histograma typeof:', Object.fromEntries(hist));
  console.log(DIVIDER);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
