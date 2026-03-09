// Note: @cloudflare/workers-types overrides TLS interfaces globally which makes
// MongoClientOptions appear to require many TLS-specific properties. The cast
// below is intentional — the runtime options are valid MongoDB driver options.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { MongoClient } from 'mongodb';

/**
 * Module-level cache — persists across warm invocations within the same
 * CF Workers isolate instance, avoiding a fresh TCP handshake per request.
 * On cold starts (new isolate), a fresh connection is established.
 */
let cachedClient: MongoClient | null = null;
let cachedUri: string | null = null;

const MONGO_OPTIONS = {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
  socketTimeoutMS: 10000,
};

export async function getMongoClient(uri: string): Promise<MongoClient> {
  // Reuse existing client if URI hasn't changed
  if (cachedClient && cachedUri === uri) {
    return cachedClient;
  }

  // Close stale client if URI changed
  if (cachedClient) {
    try {
      await cachedClient.close();
    } catch {
      // Ignore close errors
    }
    cachedClient = null;
  }

  const client = new MongoClient(uri, MONGO_OPTIONS as any);

  await client.connect();

  cachedClient = client;
  cachedUri = uri;

  return cachedClient;
}
