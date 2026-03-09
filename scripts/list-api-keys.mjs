#!/usr/bin/env node
/**
 * List all API keys stored in Cloudflare KV.
 *
 * Usage:
 *   node scripts/list-api-keys.mjs
 */

import { execSync } from 'child_process';

try {
  const raw = execSync('wrangler kv:key list --binding=API_KEYS', { encoding: 'utf8' });
  const keys = JSON.parse(raw);

  if (!keys.length) {
    console.log('No API keys found.');
    process.exit(0);
  }

  console.log(`\nFound ${keys.length} API key(s):\n`);
  console.log('─'.repeat(80));

  for (const { name: keyName } of keys) {
    try {
      const val = execSync(`wrangler kv:key get --binding=API_KEYS "${keyName}"`, {
        encoding: 'utf8',
      });
      const data = JSON.parse(val);
      const status = data.active ? '✅ active' : '❌ revoked';
      console.log(`Key:     ${keyName}`);
      console.log(`Name:    ${data.name}`);
      console.log(`Created: ${data.created}`);
      console.log(`Status:  ${status}`);
      if (data.revoked) console.log(`Revoked: ${data.revoked}`);
      console.log('─'.repeat(80));
    } catch {
      console.log(`Key: ${keyName}  (could not fetch value)`);
      console.log('─'.repeat(80));
    }
  }
} catch (err) {
  console.error('Failed to list API keys:', err.message);
  process.exit(1);
}
