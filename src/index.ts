/// <reference types="@cloudflare/workers-types" />

import type { Env } from './types';
import { authenticate } from './middleware/auth';
import { handleHealth } from './handlers/health';
import {
  handleGetAllLatest,
  handleGetLatest,
  handleGetByDate,
  handleGetHistory,
} from './handlers/rates';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'X-API-Key, Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // ── CORS preflight ────────────────────────────────────────────────────
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // ── Only GET allowed ──────────────────────────────────────────────────
    if (method !== 'GET') {
      return json({ success: false, error: 'Method not allowed.' }, 405);
    }

    // ── Public routes (no auth) ───────────────────────────────────────────
    if (pathname === '/' || pathname === '/health') {
      return handleHealth();
    }

    // ── Protected /v1/* routes ────────────────────────────────────────────
    if (pathname.startsWith('/v1/')) {
      const authError = await authenticate(request, env);
      if (authError) return authError;

      // GET /v1/rates
      if (pathname === '/v1/rates') {
        return handleGetAllLatest(env);
      }

      // GET /v1/rates/:currency/history
      const historyMatch = pathname.match(/^\/v1\/rates\/([a-z]+)\/history$/);
      if (historyMatch) {
        return handleGetHistory(historyMatch[1], url, env);
      }

      // GET /v1/rates/:currency/date/:date
      const dateMatch = pathname.match(/^\/v1\/rates\/([a-z]+)\/date\/(\d{4}-\d{2}-\d{2})$/);
      if (dateMatch) {
        return handleGetByDate(dateMatch[1], dateMatch[2], env);
      }

      // GET /v1/rates/:currency
      const currencyMatch = pathname.match(/^\/v1\/rates\/([a-z]+)$/);
      if (currencyMatch) {
        return handleGetLatest(currencyMatch[1], env);
      }
    }

    return json({ success: false, error: 'Not found.' }, 404);
  },
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
