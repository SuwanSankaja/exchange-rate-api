#!/usr/bin/env node
/**
 * Revoke an API key (sets active: false in KV).
 * The key entry is kept for audit purposes — use `--delete` to remove it entirely.
 *
 * Usage:
 *   node scripts/revoke-api-key.mjs <key>          # deactivate
 *   node scripts/revoke-api-key.mjs <key> --delete # remove from KV entirely
 *
 * Example:
 *   node scripts/revoke-api-key.mjs key_abc123xyz
 */

import { execSync } from 'child_process';

const key = process.argv[2];
const hardDelete = process.argv.includes('--delete');

if (!key) {
  console.error('Usage: node scripts/revoke-api-key.mjs <key> [--delete]');
  console.error("Run `node scripts/list-api-keys.mjs` to see all keys.");
  process.exit(1);
}

try {
  if (hardDelete) {
    execSync(`wrangler kv:key delete --binding=API_KEYS "${key}"`, { stdio: 'inherit' });
    console.log(`\nKey ${key} permanently deleted from KV.\n`);
  } else {
    // Soft revoke — fetch current data, flip active to false
    const raw = execSync(`wrangler kv:key get --binding=API_KEYS "${key}"`, { encoding: 'utf8' });
    const data = JSON.parse(raw);

    if (!data.active) {
      console.log(`Key "${key}" is already revoked.`);
      process.exit(0);
    }

    data.active = false;
    data.revoked = new Date().toISOString().split('T')[0];

    execSync(
      `wrangler kv:key put --binding=API_KEYS "${key}" '${JSON.stringify(data)}'`,
      { stdio: 'inherit' },
    );

    console.log(`\nKey "${key}" (name: ${data.name}) has been revoked.\n`);
  }
} catch (err) {
  console.error('Failed to revoke API key:', err.message);
  process.exit(1);
}
