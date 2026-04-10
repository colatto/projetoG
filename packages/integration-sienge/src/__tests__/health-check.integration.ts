/**
 * Health Check — Sienge API Connectivity Validation
 *
 * This script validates that:
 * 1. Credentials (Basic Auth user:password) are correct
 * 2. The base URL resolves and responds
 * 3. The API returns a valid response for a simple read operation
 *
 * Usage: npx tsx packages/integration-sienge/src/__tests__/health-check.integration.ts
 * Requires: apps/api/.env with SIENGE_BASE_URL, SIENGE_API_KEY, SIENGE_API_SECRET
 */

import { resolve } from 'node:path';
import { config } from 'dotenv';
import { createSiengeClient } from '../index.js';

// Load env from apps/api/.env (where Sienge credentials live)
const envPath = resolve(import.meta.dirname, '../../../../apps/api/.env');
config({ path: envPath });

const DIVIDER = '─'.repeat(60);

async function runHealthCheck(): Promise<void> {
  console.log(DIVIDER);
  console.log('🔍 Sienge API — Health Check');
  console.log(DIVIDER);

  // Step 1: Validate env vars exist
  const envVars = {
    SIENGE_BASE_URL: process.env.SIENGE_BASE_URL,
    SIENGE_API_KEY: process.env.SIENGE_API_KEY,
    SIENGE_API_SECRET: process.env.SIENGE_API_SECRET,
  };

  console.log('\n📋 Environment Variables:');
  console.log(`   SIENGE_BASE_URL:   ${envVars.SIENGE_BASE_URL ?? '❌ MISSING'}`);
  console.log(`   SIENGE_API_KEY:    ${envVars.SIENGE_API_KEY ?? '❌ MISSING'}`);
  console.log(`   SIENGE_API_SECRET: ${envVars.SIENGE_API_SECRET ? '***REDACTED***' : '❌ MISSING'}`);

  if (!envVars.SIENGE_BASE_URL || !envVars.SIENGE_API_KEY || !envVars.SIENGE_API_SECRET) {
    console.error('\n❌ Missing required environment variables. Aborting.');
    process.exit(1);
  }

  // Step 2: Create client (validates schema via Zod)
  console.log('\n🔧 Creating SiengeClient...');
  let client;
  try {
    client = createSiengeClient(envVars);
    console.log('   ✅ Client created successfully (Zod validation passed)');
  } catch (error) {
    console.error(`   ❌ Client creation failed: ${(error as Error).message}`);
    process.exit(1);
  }

  // Step 3: Test connectivity with a simple read - GET /creditors?limit=1
  console.log('\n🌐 Testing connectivity: GET /creditors?limit=1');
  try {
    const result = await client.get<Record<string, unknown>>(
      '/creditors',
      { correlationId: 'health-check', source: 'unknown' },
      { params: { limit: 1 } }
    );
    console.log('   ✅ Connection successful!');
    console.log(`   Response keys: ${Object.keys(result).join(', ')}`);

    if ('resultSetMetadata' in result) {
      const metadata = result.resultSetMetadata as Record<string, unknown>;
      console.log(`   Total records available: ${metadata.count ?? 'unknown'}`);
    }

    if ('results' in result && Array.isArray(result.results) && result.results.length > 0) {
      const firstRecord = result.results[0] as Record<string, unknown>;
      console.log(`   First record keys: ${Object.keys(firstRecord).join(', ')}`);

      // Check if contacts[] with email is available (PRDGlobal §9.5 validation)
      if ('contacts' in firstRecord && Array.isArray(firstRecord.contacts)) {
        const contacts = firstRecord.contacts as Array<Record<string, unknown>>;
        const emailContact = contacts.find(c => c.email && typeof c.email === 'string' && (c.email as string).trim() !== '');
        console.log(`   contacts[] available: ✅ (${contacts.length} contacts)`);
        console.log(`   First email found: ${emailContact ? '✅ ' + emailContact.email : '⚠️ No email in contacts'}`);
      }
    }
  } catch (error: unknown) {
    const err = error as { response?: { status?: number; data?: unknown }; message: string };
    console.error(`   ❌ Connection failed!`);
    console.error(`   Status: ${err.response?.status ?? 'No response'}`);
    console.error(`   Error: ${err.message}`);

    if (err.response?.status === 401) {
      console.error('   💡 401 Unauthorized — Check SIENGE_API_KEY and SIENGE_API_SECRET values');
    } else if (err.response?.status === 403) {
      console.error('   💡 403 Forbidden — Credentials valid but insufficient permissions');
    }

    process.exit(1);
  }

  // Step 4: Test a quotation-related endpoint - GET /purchase-quotations/all/negotiations?limit=1
  console.log('\n🌐 Testing quotations: GET /purchase-quotations/all/negotiations?limit=1');
  try {
    const result = await client.get<Record<string, unknown>>(
      '/purchase-quotations/all/negotiations',
      { correlationId: 'health-check-quotations', source: 'unknown' },
      { params: { limit: 1 } }
    );
    console.log('   ✅ Quotations endpoint accessible!');

    if ('resultSetMetadata' in result) {
      const metadata = result.resultSetMetadata as Record<string, unknown>;
      console.log(`   Total quotations available: ${metadata.count ?? 'unknown'}`);
    }

    if ('results' in result && Array.isArray(result.results) && result.results.length > 0) {
      const first = result.results[0] as Record<string, unknown>;
      console.log(`   First record keys: ${Object.keys(first).join(', ')}`);
      if ('supplierId' in first) {
        console.log(`   supplierId present: ✅ (value: ${first.supplierId})`);
      }
    }
  } catch (error: unknown) {
    const err = error as { response?: { status?: number }; message: string };
    console.error(`   ⚠️ Quotations endpoint failed: ${err.response?.status ?? 'No response'} — ${err.message}`);
    console.error('   (This may be expected if no quotations exist yet)');
  }

  console.log(`\n${DIVIDER}`);
  console.log('✅ Health check completed successfully');
  console.log(DIVIDER);
}

runHealthCheck().catch((error: unknown) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
