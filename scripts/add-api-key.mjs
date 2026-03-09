#!/usr/bin/env node
/**
 * Add a new API key to Cloudflare KV.
 *
 * Usage:
 *   node scripts/add-api-key.mjs <name>
 *
 * Examples:
 *   node scripts/add-api-key.mjs "exchange-rate-dashboard"
 *   node scripts/add-api-key.mjs "mobile-app"
 */

import { execSync } from 'child_process';
import { randomBytes } from 'crypto';

const name = process.argv[2];

if (!name) {
  console.error('Usage: node scripts/add-api-key.mjs <name>');
  console.error('Example: node scripts/add-api-key.mjs "my-app"');
  process.exit(1);
}

const key = 'key_' + randomBytes(24).toString('hex');
const value = JSON.stringify({
  name,
  created: new Date().toISOString().split('T')[0],
  active: true,
});

console.log(`\nAdding API key for "${name}"...`);

try {
  execSync(`wrangler kv:key put --binding=API_KEYS "${key}" '${value}'`, {
    stdio: 'inherit',
  });

  console.log('\n─────────────────────────────────────────');
  console.log(`  API Key:  ${key}`);
  console.log(`  Name:     ${name}`);
  console.log('─────────────────────────────────────────');
  console.log('Store this key safely — it will not be shown again.\n');
} catch (err) {
  console.error('\nFailed to add API key:', err.message);
  process.exit(1);
}
