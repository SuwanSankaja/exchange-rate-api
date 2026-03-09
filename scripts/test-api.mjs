#!/usr/bin/env node
/**
 * API Test Script — exchange-rate-api
 *
 * Usage:
 *   node scripts/test-api.mjs                  # runs all tests against production
 *   node scripts/test-api.mjs --local          # runs against localhost:8787
 *   node scripts/test-api.mjs --key=key_xxx    # override API key
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// ─── Load .env ───────────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const env = {};
    const lines = readFileSync(resolve(PROJECT_ROOT, '.env'), 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...rest] = trimmed.split('=');
      env[key.trim()] = rest.join('=').trim();
    }
    return env;
  } catch {
    return {};
  }
}

const env = loadEnv();
const useLocal = process.argv.includes('--local');
const keyArg = process.argv.find(a => a.startsWith('--key='));

const BASE_URL = useLocal ? 'http://localhost:8787' : (env.API_BASE_URL || 'https://exchange-rate-api.suwan-sankaja.workers.dev');
const API_KEY = keyArg ? keyArg.split('=')[1] : (env.TEST_API_KEY || '');

if (!API_KEY) {
  console.error('No API key found. Set TEST_API_KEY in .env or pass --key=xxx');
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

async function test(label, fn) {
  process.stdout.write(`  ${label} ... `);
  try {
    const result = await fn();
    console.log('\x1b[32m✓ PASS\x1b[0m');
    if (result?.response !== undefined) {
      console.log(`    \x1b[90m↳ ${JSON.stringify(result.response, null, 2).split('\n').join('\n      ')}\x1b[0m`);
    }
    passed++;
  } catch (err) {
    console.log(`\x1b[31m✗ FAIL\x1b[0m — ${err.message}`);
    if (err.response !== undefined) {
      console.log(`    \x1b[90m↳ ${JSON.stringify(err.response, null, 2).split('\n').join('\n      ')}\x1b[0m`);
    }
    failed++;
  }
}

async function get(path, withKey = true) {
  const headers = withKey ? { 'X-API-Key': API_KEY } : {};
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  const body = await res.json();
  return { status: res.status, body };
}

function assert(condition, message, response) {
  if (!condition) {
    const err = new Error(message);
    err.response = response;
    throw err;
  }
}

// ─── Test Suites ─────────────────────────────────────────────────────────────
console.log(`\n🧪 Exchange Rate API Tests`);
console.log(`   Base URL: ${BASE_URL}`);
console.log(`   API Key:  ${API_KEY.slice(0, 12)}...`);
console.log('─'.repeat(50));

// ── 1. Health ──────────────────────────────────────────────────────────────
console.log('\n📋 Health');

await test('GET /health returns 200', async () => {
  const { status, body } = await get('/health', false);
  assert(status === 200, `Expected 200, got ${status}`, body);
  assert(body.status === 'OK', `Expected status OK, got ${body.status}`, body);
  return { response: body };
});

// ── 2. Auth ────────────────────────────────────────────────────────────────
console.log('\n🔐 Auth');

await test('No API key returns 401', async () => {
  const { status, body } = await get('/v1/rates/usd', false);
  assert(status === 401, `Expected 401, got ${status}`, body);
  return { response: body };
});

await test('Invalid API key returns 401', async () => {
  const res = await fetch(`${BASE_URL}/v1/rates/usd`, {
    headers: { 'X-API-Key': 'key_invalid_fake_key' },
  });
  const body = await res.json();
  assert(res.status === 401, `Expected 401, got ${res.status}`, body);
  return { response: body };
});

await test('Valid API key returns 200', async () => {
  const { status, body } = await get('/v1/rates/usd');
  assert(status === 200, `Expected 200, got ${status}`, body);
  return { response: body };
});

// ── 3. Currency routes ────────────────────────────────────────────────────
console.log('\n💱 Currency endpoints');

for (const currency of ['usd', 'aud', 'eur', 'gbp']) {
  await test(`GET /v1/rates/${currency} returns data`, async () => {
    const { status, body } = await get(`/v1/rates/${currency}`);
    assert(status === 200, `Expected 200, got ${status}`, body);
    assert(body.success === true, 'Expected success=true', body);
    assert(body.data, 'Expected data field', body);
    assert(body.currency === currency.toUpperCase(), `Expected currency=${currency.toUpperCase()}`, body);
    return { response: body };
  });
}

await test('GET /v1/rates returns all currencies', async () => {
  const { status, body } = await get('/v1/rates');
  assert(status === 200, `Expected 200, got ${status}`, body);
  assert(body.success === true, 'Expected success=true', body);
  assert(typeof body.data === 'object', 'Expected data object', body);
  for (const c of ['usd', 'aud', 'eur', 'gbp']) {
    assert(c in body.data, `Expected ${c} in data`, body);
  }
  return { response: body };
});

await test('Invalid currency returns 400', async () => {
  const { status, body } = await get('/v1/rates/xyz');
  assert(status === 400, `Expected 400, got ${status}`, body);
  return { response: body };
});

// ── 4. Date route ─────────────────────────────────────────────────────────
console.log('\n📅 Date endpoint');

await test('GET /v1/rates/usd/date/YYYY-MM-DD valid format', async () => {
  const today = new Date().toISOString().split('T')[0];
  const { status, body } = await get(`/v1/rates/usd/date/${today}`);
  assert([200, 404].includes(status), `Expected 200 or 404, got ${status}`, body);
  return { response: body };
});

await test('Invalid date format returns 400', async () => {
  const { status, body } = await get('/v1/rates/usd/date/09-03-2026');
  assert(status === 400, `Expected 400, got ${status}`, body);
  return { response: body };
});

// ── 5. History route ──────────────────────────────────────────────────────
console.log('\n📈 History endpoint');

await test('GET /v1/rates/usd/history returns array', async () => {
  const { status, body } = await get('/v1/rates/usd/history?limit=5');
  assert(status === 200, `Expected 200, got ${status}`, body);
  assert(Array.isArray(body.data), 'Expected data to be an array', body);
  assert(body.count !== undefined, 'Expected count field', body);
  return { response: body };
});

await test('History limit has no hard cap', async () => {
  const { status, body } = await get('/v1/rates/usd/history?limit=500');
  assert(status === 200, `Expected 200, got ${status}`, body);
  assert(body.filters.limit === 500, `Expected limit=500, got ${body.filters.limit}`, body);
  return { response: body };
});

await test('History from/to filter works', async () => {
  const { status, body } = await get('/v1/rates/usd/history?from=2026-01-01&to=2026-03-09');
  assert(status === 200, `Expected 200, got ${status}`, body);
  assert(body.filters.from === '2026-01-01', 'Expected from filter applied', body);
  return { response: body };
});

await test('Invalid from date returns 400', async () => {
  const { status, body } = await get('/v1/rates/usd/history?from=bad-date');
  assert(status === 400, `Expected 400, got ${status}`, body);
  return { response: body };
});

await test('History bank filter — multiple banks', async () => {
  const { status, body } = await get('/v1/rates/usd/history?limit=3&banks=Sampath Bank,Commercial Bank');
  assert(status === 200, `Expected 200, got ${status}`, body);
  assert(Array.isArray(body.data), 'Expected data array', body);
  assert(body.filters.banks !== null, 'Expected banks filter in response', body);
  for (const doc of body.data) {
    for (const bankName of Object.keys(doc.bank_rates ?? {})) {
      assert(
        ['sampath bank', 'commercial bank'].includes(bankName.toLowerCase()),
        `Unexpected bank "${bankName}" in filtered result`,
        body,
      );
    }
  }
  return { response: body };
});

await test('History bank filter — single bank', async () => {
  const { status, body } = await get('/v1/rates/usd/history?limit=3&banks=Sampath Bank');
  assert(status === 200, `Expected 200, got ${status}`, body);
  assert(body.filters.banks?.length === 1, 'Expected 1 bank in filter', body);
  for (const doc of body.data) {
    const keys = Object.keys(doc.bank_rates ?? {});
    assert(keys.every(k => k.toLowerCase() === 'sampath bank'), `Unexpected banks: ${keys.join(', ')}`, body);
  }
  return { response: body };
});

// ── 6. Not found ──────────────────────────────────────────────────────────
console.log('\n🔍 Not found');

await test('Unknown route returns 404', async () => {
  const { status, body } = await get('/v1/unknown');
  assert(status === 404, `Expected 404, got ${status}`, body);
  return { response: body };
});

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
const total = passed + failed;
if (failed === 0) {
  console.log(`\x1b[32m✅ All ${total} tests passed\x1b[0m\n`);
} else {
  console.log(`\x1b[31m❌ ${failed}/${total} tests failed\x1b[0m\n`);
  process.exit(1);
}
