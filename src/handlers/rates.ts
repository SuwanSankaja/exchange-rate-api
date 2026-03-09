import type { Env } from '../types';
import { getMongoClient } from '../db/client';

const VALID_CURRENCIES = ['aud', 'usd', 'eur', 'gbp'] as const;
type Currency = (typeof VALID_CURRENCIES)[number];

// Fields stripped from every API response (internal scraper metadata)
const STRIP_PROJECTION = {
  _id: 0,
  source: 0,
  execution_environment: 0,
  data_completeness: 0,
  bank_summary: 0,
  market_statistics: 0,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function isValidCurrency(c: string): c is Currency {
  return (VALID_CURRENCIES as readonly string[]).includes(c);
}

function isValidDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function todayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function notFound(msg: string): Response {
  return json({ success: false, error: msg }, 404);
}

function badRequest(msg: string): Response {
  return json({ success: false, error: msg }, 400);
}

function serverError(err: unknown): Response {
  console.error('[rates handler]', err);
  return json({ success: false, error: 'Internal server error.' }, 500);
}

function getCollection(client: Awaited<ReturnType<typeof getMongoClient>>, dbName: string, currency: string) {
  return client.db(dbName).collection(`daily_${currency}_rates`);
}

// Strip `source` from every bank entry inside bank_rates (dynamic keys, can't use projection)
function sanitizeDoc<T extends Record<string, unknown>>(doc: T): T {
  if (doc.bank_rates && typeof doc.bank_rates === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [bank, data] of Object.entries(doc.bank_rates as Record<string, unknown>)) {
      if (data && typeof data === 'object') {
        const { source: _s, ...rest } = data as Record<string, unknown>;
        cleaned[bank] = rest;
      } else {
        cleaned[bank] = data;
      }
    }
    return { ...doc, bank_rates: cleaned };
  }
  return doc;
}

// Filter bank_rates to only the requested banks (case-insensitive) and update total_banks
function filterBanks(doc: Record<string, unknown>, banks: string[]): Record<string, unknown> {
  if (!banks.length || !doc.bank_rates || typeof doc.bank_rates !== 'object') return doc;
  const lower = banks.map(b => b.toLowerCase());
  const filtered: Record<string, unknown> = {};
  for (const [bank, data] of Object.entries(doc.bank_rates as Record<string, unknown>)) {
    if (lower.includes(bank.toLowerCase())) filtered[bank] = data;
  }
  return { ...doc, bank_rates: filtered, total_banks: Object.keys(filtered).length };
}

// ─── GET /v1/rates  (all currencies, latest) ────────────────────────────────

export async function handleGetAllLatest(env: Env): Promise<Response> {
  try {
    const client = await getMongoClient(env.MONGODB_URI);
    const today = todayDate();

    const results = await Promise.all(
      VALID_CURRENCIES.map(async (currency) => {
        const col = getCollection(client, env.DB_NAME, currency);
        // Try today first, fall back to the most recent available date
        let doc = await col.findOne({ date: today }, { projection: STRIP_PROJECTION });
        if (!doc) {
          doc = await col.findOne({}, { sort: { date: -1 }, projection: STRIP_PROJECTION });
        }
        return [currency, doc ? sanitizeDoc(doc as Record<string, unknown>) : doc] as const;
      }),
    );

    const data = Object.fromEntries(results);

    return json({ success: true, as_of: today, data });
  } catch (err) {
    return serverError(err);
  }
}

// ─── GET /v1/rates/:currency  (latest for one currency) ─────────────────────

export async function handleGetLatest(currency: string, env: Env): Promise<Response> {
  if (!isValidCurrency(currency)) {
    return badRequest(`Invalid currency "${currency}". Valid options: ${VALID_CURRENCIES.join(', ')}.`);
  }

  try {
    const client = await getMongoClient(env.MONGODB_URI);
    const col = getCollection(client, env.DB_NAME, currency);
    const today = todayDate();

    let doc = await col.findOne({ date: today }, { projection: STRIP_PROJECTION });
    if (!doc) {
      doc = await col.findOne({}, { sort: { date: -1 }, projection: STRIP_PROJECTION });
    }

    if (!doc) {
      return notFound(`No data found for ${currency.toUpperCase()}.`);
    }

    return json({ success: true, currency: currency.toUpperCase(), data: sanitizeDoc(doc as Record<string, unknown>) });
  } catch (err) {
    return serverError(err);
  }
}

// ─── GET /v1/rates/:currency/date/:date ─────────────────────────────────────

export async function handleGetByDate(currency: string, date: string, env: Env): Promise<Response> {
  if (!isValidCurrency(currency)) {
    return badRequest(`Invalid currency "${currency}". Valid options: ${VALID_CURRENCIES.join(', ')}.`);
  }

  if (!isValidDate(date)) {
    return badRequest('Invalid date format. Use YYYY-MM-DD.');
  }

  try {
    const client = await getMongoClient(env.MONGODB_URI);
    const col = getCollection(client, env.DB_NAME, currency);

    const doc = await col.findOne({ date }, { projection: STRIP_PROJECTION });

    if (!doc) {
      return notFound(`No data found for ${currency.toUpperCase()} on ${date}.`);
    }

    return json({ success: true, currency: currency.toUpperCase(), date, data: sanitizeDoc(doc as Record<string, unknown>) });
  } catch (err) {
    return serverError(err);
  }
}

// ─── GET /v1/rates/:currency/history?from=&to=&limit=&banks= ───────────────

export async function handleGetHistory(currency: string, url: URL, env: Env): Promise<Response> {
  if (!isValidCurrency(currency)) {
    return badRequest(`Invalid currency "${currency}". Valid options: ${VALID_CURRENCIES.join(', ')}.`);
  }

  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const limitParam = url.searchParams.get('limit');
  const limit = Math.max(parseInt(limitParam ?? '30', 10) || 30, 1);
  const banksParam = url.searchParams.get('banks');
  const banks: string[] = banksParam ? banksParam.split(',').map(b => b.trim()).filter(Boolean) : [];

  if (from && !isValidDate(from)) {
    return badRequest('Invalid "from" date. Use YYYY-MM-DD.');
  }
  if (to && !isValidDate(to)) {
    return badRequest('Invalid "to" date. Use YYYY-MM-DD.');
  }

  const filter: Record<string, unknown> = {};
  if (from || to) {
    const dateFilter: Record<string, string> = {};
    if (from) dateFilter.$gte = from;
    if (to) dateFilter.$lte = to;
    filter.date = dateFilter;
  }

  try {
    const client = await getMongoClient(env.MONGODB_URI);
    const col = getCollection(client, env.DB_NAME, currency);

    const docs = (await col
      .find(filter, { projection: STRIP_PROJECTION })
      .sort({ date: -1 })
      .limit(limit)
      .toArray())
      .map(doc => filterBanks(sanitizeDoc(doc as Record<string, unknown>), banks));

    return json({
      success: true,
      currency: currency.toUpperCase(),
      count: docs.length,
      filters: {
        from: from ?? null,
        to: to ?? null,
        limit,
        banks: banks.length ? banks : null,
      },
      data: docs,
    });
  } catch (err) {
    return serverError(err);
  }
}
