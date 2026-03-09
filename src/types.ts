/// <reference types="@cloudflare/workers-types" />

export interface Env {
  /** KV namespace binding — stores API key metadata */
  API_KEYS: KVNamespace;
  /** MongoDB Atlas connection string — set via `wrangler secret put MONGODB_URI` */
  MONGODB_URI: string;
  /** MongoDB database name — set in wrangler.toml [vars] */
  DB_NAME: string;
}

export interface ApiKeyData {
  name: string;
  created: string;
  active: boolean;
  daily_limit?: number; // max requests per day, undefined = unlimited
  revoked?: string;
}

export interface BankRate {
  bank_name: string;
  buying_rate: number;
  selling_rate: number;
  spread: number;
  source: string;
}

export interface MarketStats {
  people_selling: {
    min: number;
    max: number;
    avg: number;
    best_bank: string;
  };
  people_buying: {
    min: number;
    max: number;
    avg: number;
    best_bank: string;
  };
}

export interface ExchangeRateDocument {
  date: string;
  last_updated: Date | string;
  currency: string;
  total_banks: number;
  bank_summary: BankRate[];
  bank_rates: Record<string, {
    buying_rate: number;
    selling_rate: number;
    spread: number;
    last_updated: Date | string;
    source: string;
  }>;
  market_statistics: MarketStats;
}
