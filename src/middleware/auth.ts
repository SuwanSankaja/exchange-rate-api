/// <reference types="@cloudflare/workers-types" />

import type { Env, ApiKeyData } from '../types';

/**
 * Validates the `X-API-Key` header against entries stored in Cloudflare KV.
 * Also enforces per-key daily rate limits when configured.
 * Returns a Response on failure, or null if auth passed.
 */
export async function authenticate(request: Request, env: Env): Promise<Response | null> {
  const apiKey = request.headers.get('X-API-Key');

  if (!apiKey) {
    return jsonError('Missing API key. Include an X-API-Key header.', 401);
  }

  let keyData: ApiKeyData | null = null;

  try {
    keyData = await env.API_KEYS.get<ApiKeyData>(apiKey, { type: 'json' });
  } catch {
    return jsonError('Internal error validating API key.', 500);
  }

  if (!keyData) {
    return jsonError('Invalid API key.', 401);
  }

  if (!keyData.active) {
    return jsonError('API key has been revoked.', 403);
  }

  // ── Rate limiting (probabilistic writes) ────────────────────────────────
  // To stay within KV write limits on the free tier, we only write the counter
  // on 1-in-WRITE_EVERY requests. The stored value is incremented by WRITE_EVERY
  // each time, keeping the approximate count correct. The actual limit enforced
  // is (daily_limit - WRITE_EVERY) to absorb the worst-case overshoot.
  if (keyData.daily_limit !== undefined && keyData.daily_limit > 0) {
    const WRITE_EVERY = 100; // 100× fewer KV writes (~50/day at 5k req/day)
    const today = new Date().toISOString().split('T')[0];
    const counterKey = `rl:${apiKey}:${today}`;

    const raw = await env.API_KEYS.get(counterKey);
    const count = raw ? parseInt(raw, 10) : 0;

    // Enforce at (limit - WRITE_EVERY) to absorb worst-case overshoot
    if (count >= keyData.daily_limit - WRITE_EVERY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Daily request limit of ${keyData.daily_limit.toLocaleString()} reached. Resets at midnight UTC.`,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(keyData.daily_limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': nextMidnightUTC(),
          },
        },
      );
    }

    // Write only 1-in-WRITE_EVERY requests; increment by WRITE_EVERY to compensate
    if (Math.random() < 1 / WRITE_EVERY) {
      const secondsUntilMidnight = getSecondsUntilMidnightUTC();
      await env.API_KEYS.put(counterKey, String(count + WRITE_EVERY), {
        expirationTtl: secondsUntilMidnight,
      });
    }
  }

  return null; // Auth passed
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getSecondsUntilMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.max(60, Math.floor((midnight.getTime() - now.getTime()) / 1000));
}

function nextMidnightUTC(): string {
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  return String(Math.floor(midnight.getTime() / 1000));
}
