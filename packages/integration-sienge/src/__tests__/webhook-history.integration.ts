/**
 * PRD §17.3 / §17.4 — Histórico de webhooks recebidos (somente leitura Supabase).
 *
 * Conta registros em `webhook_events` nos últimos 30 dias para os tipos críticos.
 *
 * Requer: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (apps/api/.env ou workers/.env)
 *
 * Uso (raiz): pnpm --filter @projetog/integration-sienge exec tsx src/__tests__/webhook-history.integration.ts
 */

import { resolve } from 'node:path';
import { config } from 'dotenv';

const apiEnv = resolve(import.meta.dirname, '../../../../apps/api/.env');
const workersEnv = resolve(import.meta.dirname, '../../../../workers/.env');
config({ path: apiEnv });
config({ path: workersEnv });

const DIVIDER = '─'.repeat(70);

const TARGET_TYPES = [
  'PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION',
  'PURCHASE_QUOTATION_NEGOTIATION_AUTHORIZATION_CHANGED',
] as const;

interface WebhookRow {
  webhook_type: string;
  created_at: string;
}

async function fetchWebhookRowsSince(isoSince: string): Promise<WebhookRow[]> {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.');
    process.exit(1);
  }

  const params = new URLSearchParams({
    select: 'webhook_type,created_at',
    created_at: `gte.${isoSince}`,
    order: 'created_at.desc',
    limit: '500',
  });

  const url = `${base.replace(/\/$/, '')}/rest/v1/webhook_events?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  if (!res.ok) {
    console.error(`❌ Supabase REST error ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  return (await res.json()) as WebhookRow[];
}

async function run(): Promise<void> {
  console.log(DIVIDER);
  console.log('📬 Webhook history — §17.3 / §17.4');
  console.log(DIVIDER);

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const isoSince = since.toISOString();

  console.log(`\nJanela: created_at >= ${isoSince}\n`);

  const rows = await fetchWebhookRowsSince(isoSince);
  console.log(`Total de linhas retornadas (cap 500): ${rows.length}`);

  const byType = new Map<string, { count: number; last?: string }>();
  for (const t of TARGET_TYPES) {
    byType.set(t, { count: 0 });
  }

  for (const row of rows) {
    const cur = byType.get(row.webhook_type) ?? { count: 0 };
    cur.count += 1;
    if (!cur.last) cur.last = row.created_at;
    byType.set(row.webhook_type, cur);
  }

  for (const t of TARGET_TYPES) {
    const s = byType.get(t)!;
    console.log(`\n  ${t}`);
    console.log(`    count (na amostra): ${s.count}`);
    console.log(`    último created_at: ${s.last ?? '—'}`);
  }

  console.log(`\n${DIVIDER}`);
  console.log(
    'Interpretação: count > 0 sugere que o ambiente já recebeu o tipo no período.',
    'Ausência não prova indisponibilidade — validar com Sienge/cliente em §17.3/17.4.',
  );
  console.log(DIVIDER);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
