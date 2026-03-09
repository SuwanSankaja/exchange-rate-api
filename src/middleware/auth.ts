/// <reference types="@cloudflare/workers-types" />

import type { Env, ApiKeyData } from '../types';

/**
 * Validates the `X-API-Key` header against entries stored in Cloudflare KV.
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

  return null; // Auth passed
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
