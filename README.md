<![CDATA[<div align="center">

# 💱 Exchange Rate API

### Real-time Sri Lankan bank exchange rates — powered by Cloudflare Workers & MongoDB Atlas

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![License](https://img.shields.io/badge/License-MIT-A855F7?style=for-the-badge)](LICENSE)

<br />

<p align="center">
  <strong>A blazing-fast, edge-deployed REST API</strong> that serves daily exchange rate data for <b>USD</b>, <b>EUR</b>, <b>GBP</b>, and <b>AUD</b> against the <b>Sri Lankan Rupee (LKR)</b>, aggregated from multiple commercial banks.
</p>

<br />

[Getting Started](#-getting-started) •
[API Reference](#-api-reference) •
[Authentication](#-authentication) •
[Scripts](#-management-scripts) •
[Deployment](#-deployment)

---

</div>

<br />

## ✨ Features

| Feature | Description |
|---------|------------|
| 🌍 **Edge-First** | Deployed on Cloudflare Workers — sub-50ms latency globally |
| 🏦 **Multi-Bank Data** | Buying & selling rates from Sri Lankan commercial banks |
| 📅 **Historical Lookups** | Query exchange rates for any past date |
| 📈 **Time-Series History** | Fetch rate history with date range & bank filters |
| 🔐 **API Key Auth** | Secure access via `X-API-Key` header with KV-backed validation |
| ⚡ **Rate Limiting** | Per-key daily limits with probabilistic counters (KV-friendly) |
| 🔄 **CORS Enabled** | Ready for browser & frontend integrations out of the box |
| 🚀 **CI/CD** | Auto-deploy on push to `main` via GitHub Actions |

<br />

## 🏛️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge Network                   │
│                                                             │
│  ┌──────────┐    ┌──────────────┐    ┌────────────────────┐ │
│  │  Client   │───▶│  CF Worker   │───▶│  MongoDB Atlas     │ │
│  │  Request  │    │  (index.ts)  │    │  (exchange_rates)  │ │
│  └──────────┘    └──────┬───────┘    └────────────────────┘ │
│                         │                                   │
│                  ┌──────┴───────┐                            │
│                  │  Cloudflare  │                            │
│                  │   KV Store   │                            │
│                  │  (API Keys)  │                            │
│                  └──────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

<br />

## 📂 Project Structure

```
exchange-rate-api/
├── src/
│   ├── index.ts              # 🚀 Worker entry point & router
│   ├── types.ts              # 📝 TypeScript interfaces
│   ├── db/
│   │   └── client.ts         # 🗄️  MongoDB client with connection pooling
│   ├── handlers/
│   │   ├── health.ts         # 💚 Health check endpoint
│   │   └── rates.ts          # 💱 Exchange rate handlers
│   └── middleware/
│       └── auth.ts           # 🔐 API key validation & rate limiting
├── scripts/
│   ├── add-api-key.mjs       # ➕ Create new API keys
│   ├── list-api-keys.mjs     # 📋 List all API keys
│   ├── revoke-api-key.mjs    # 🚫 Revoke or delete API keys
│   └── test-api.mjs          # 🧪 End-to-end test suite
├── .github/
│   └── workflows/
│       └── deploy.yml        # 🚀 CI/CD pipeline
├── wrangler.toml             # ⚙️  Cloudflare Worker config
├── tsconfig.json             # 🔧 TypeScript configuration
└── package.json
```

<br />

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20+
- **npm** 9+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm i -g wrangler`)
- A [Cloudflare account](https://dash.cloudflare.com/sign-up)
- A [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

### Installation

```bash
# Clone the repository
git clone https://github.com/SuwanSankaja/exchange-rate-api.git
cd exchange-rate-api

# Install dependencies
npm install
```

### Configuration

**1. Create the KV namespace**

```bash
npm run kv:create
```

Copy the output `id` and `preview_id` into `wrangler.toml`.

**2. Set MongoDB URI as a secret**

```bash
# Production secret (stored in Cloudflare)
wrangler secret put MONGODB_URI

# Local development — create a .dev.vars file
echo 'MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net"' > .dev.vars
```

**3. Generate your first API key**

```bash
npm run key:add "my-app"

# With a daily rate limit:
npm run key:add "my-app" -- --limit=10000
```

### Running Locally

```bash
npm run dev
# → Worker running at http://localhost:8787
```

### Type Checking

```bash
npm run type-check
```

<br />

## 🔐 Authentication

All `/v1/*` routes require an API key passed via the `X-API-Key` header.

```bash
curl -H "X-API-Key: key_your_api_key_here" \
  https://exchange-rate-api.suwan-sankaja.workers.dev/v1/rates/usd
```

| Status | Meaning |
|--------|---------|
| `401` | Missing or invalid API key |
| `403` | API key has been revoked |
| `429` | Daily request limit exceeded (resets at midnight UTC) |

### Rate Limiting ⚡

Each API key can optionally have a `daily_limit`. The rate limiter uses a **probabilistic counter** strategy — only 1-in-100 requests actually writes to KV, keeping well within Cloudflare's free-tier write limits while maintaining approximate accuracy.

Rate limit headers are included in `429` responses:

```
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1714003200
```

<br />

## 📖 API Reference

**Base URL**

```
https://exchange-rate-api.suwan-sankaja.workers.dev
```

### Supported Currencies

| Code | Currency |
|------|----------|
| `usd` | 🇺🇸 United States Dollar |
| `eur` | 🇪🇺 Euro |
| `gbp` | 🇬🇧 British Pound Sterling |
| `aud` | 🇦🇺 Australian Dollar |

---

### `GET` /health

Health check — **no authentication required**.

<details>
<summary>📋 Response Example</summary>

```json
{
  "success": true,
  "status": "OK",
  "service": "exchange-rate-api",
  "timestamp": "2026-04-18T16:00:00.000Z"
}
```

</details>

---

### `GET` /v1/rates

Fetches the **latest** exchange rates for **all** supported currencies.

<details>
<summary>📋 Response Example</summary>

```json
{
  "success": true,
  "as_of": "2026-04-18",
  "data": {
    "usd": {
      "date": "2026-04-18",
      "currency": "usd",
      "total_banks": 12,
      "bank_rates": {
        "Commercial Bank": {
          "buying_rate": 295.50,
          "selling_rate": 305.00,
          "spread": 9.50,
          "last_updated": "2026-04-18T06:00:00.000Z"
        }
      }
    },
    "eur": { "..." },
    "gbp": { "..." },
    "aud": { "..." }
  }
}
```

</details>

---

### `GET` /v1/rates/:currency

Fetches the **latest** exchange rate for a specific currency.

| Parameter | Type | Description |
|-----------|------|-------------|
| `currency` | `path` | Currency code — `usd`, `eur`, `gbp`, or `aud` |

<details>
<summary>📋 Response Example</summary>

```json
{
  "success": true,
  "currency": "USD",
  "data": {
    "date": "2026-04-18",
    "currency": "usd",
    "total_banks": 12,
    "bank_rates": {
      "Commercial Bank": {
        "buying_rate": 295.50,
        "selling_rate": 305.00,
        "spread": 9.50,
        "last_updated": "2026-04-18T06:00:00.000Z"
      },
      "Sampath Bank": {
        "buying_rate": 296.00,
        "selling_rate": 304.50,
        "spread": 8.50,
        "last_updated": "2026-04-18T06:00:00.000Z"
      }
    }
  }
}
```

</details>

---

### `GET` /v1/rates/:currency/date/:date

Fetches exchange rates for a specific currency on a **specific date**.

| Parameter | Type | Description |
|-----------|------|-------------|
| `currency` | `path` | Currency code |
| `date` | `path` | Date in `YYYY-MM-DD` format |

```bash
curl -H "X-API-Key: $API_KEY" \
  https://exchange-rate-api.suwan-sankaja.workers.dev/v1/rates/usd/date/2026-04-15
```

<details>
<summary>📋 Response Example</summary>

```json
{
  "success": true,
  "currency": "USD",
  "date": "2026-04-15",
  "data": {
    "date": "2026-04-15",
    "currency": "usd",
    "total_banks": 12,
    "bank_rates": { "..." }
  }
}
```

</details>

---

### `GET` /v1/rates/:currency/history

Fetches **historical** exchange rate data with optional filters.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `currency` | `path` | — | Currency code |
| `from` | `query` | — | Start date (`YYYY-MM-DD`) |
| `to` | `query` | — | End date (`YYYY-MM-DD`) |
| `limit` | `query` | `30` | Max number of records to return |
| `banks` | `query` | — | Comma-separated list of bank names to filter |

```bash
# Last 7 days of USD rates
curl -H "X-API-Key: $API_KEY" \
  "https://exchange-rate-api.suwan-sankaja.workers.dev/v1/rates/usd/history?limit=7"

# Specific date range, filtered to 2 banks
curl -H "X-API-Key: $API_KEY" \
  "https://exchange-rate-api.suwan-sankaja.workers.dev/v1/rates/usd/history?from=2026-01-01&to=2026-03-31&banks=Sampath Bank,Commercial Bank"
```

<details>
<summary>📋 Response Example</summary>

```json
{
  "success": true,
  "currency": "USD",
  "count": 7,
  "filters": {
    "from": null,
    "to": null,
    "limit": 7,
    "banks": null
  },
  "data": [
    {
      "date": "2026-04-18",
      "currency": "usd",
      "total_banks": 12,
      "bank_rates": { "..." }
    },
    {
      "date": "2026-04-17",
      "currency": "usd",
      "total_banks": 12,
      "bank_rates": { "..." }
    }
  ]
}
```

</details>

<br />

## ❌ Error Responses

All errors follow a consistent format:

```json
{
  "success": false,
  "error": "Descriptive error message."
}
```

| Status | Error |
|--------|-------|
| `400` | Invalid currency or malformed date |
| `401` | Missing or invalid API key |
| `403` | Revoked API key |
| `404` | No data found / unknown route |
| `405` | Method not allowed (only `GET` is supported) |
| `429` | Daily rate limit exceeded |
| `500` | Internal server error |

<br />

## 🛠️ Management Scripts

Manage API keys directly from your terminal using the built-in CLI scripts:

### ➕ Add a new key

```bash
npm run key:add "dashboard-app"
npm run key:add "mobile-client" -- --limit=5000
```

### 📋 List all keys

```bash
npm run key:list
```

### 🚫 Revoke a key

```bash
# Soft revoke (keeps record for audit)
npm run key:revoke key_abc123...

# Hard delete from KV
npm run key:revoke key_abc123... -- --delete
```

### 🧪 Run tests

```bash
# Against production
npm test

# Against local dev server
npm run test:local

# With a specific API key
npm test -- --key=key_your_key_here
```

> **Note:** Create a `.env` file with `TEST_API_KEY` and optionally `API_BASE_URL` to skip passing flags manually.

<br />

## 🚀 Deployment

### Automatic (CI/CD)

Every push to `main` triggers the GitHub Actions workflow:

1. ✅ Checks out the code
2. 📦 Installs dependencies (`npm ci`)
3. 🔍 Runs type checking
4. 🚀 Deploys to Cloudflare Workers via `wrangler`

**Required GitHub Secrets:**

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Workers deploy permissions |

> MongoDB URI is managed as a Cloudflare secret (`wrangler secret put MONGODB_URI`), not a GitHub secret.

### Manual

```bash
npm run deploy
```

<br />

## 🗄️ Database Schema

Data is stored in MongoDB Atlas with one collection per currency:

| Collection | Description |
|------------|-------------|
| `daily_usd_rates` | 🇺🇸 USD/LKR daily rates |
| `daily_eur_rates` | 🇪🇺 EUR/LKR daily rates |
| `daily_gbp_rates` | 🇬🇧 GBP/LKR daily rates |
| `daily_aud_rates` | 🇦🇺 AUD/LKR daily rates |

Each document structure:

```json
{
  "date": "2026-04-18",
  "last_updated": "2026-04-18T06:00:00.000Z",
  "currency": "usd",
  "total_banks": 12,
  "bank_rates": {
    "Bank Name": {
      "buying_rate": 295.50,
      "selling_rate": 305.00,
      "spread": 9.50,
      "last_updated": "2026-04-18T06:00:00.000Z"
    }
  }
}
```

<br />

## 🧰 Tech Stack

| Technology | Purpose |
|------------|---------|
| [Cloudflare Workers](https://workers.cloudflare.com/) | Serverless edge runtime |
| [Cloudflare KV](https://developers.cloudflare.com/kv/) | API key storage & rate limiting |
| [MongoDB Atlas](https://www.mongodb.com/atlas) | Exchange rate data persistence |
| [TypeScript](https://www.typescriptlang.org/) | Type-safe application logic |
| [Wrangler](https://developers.cloudflare.com/workers/wrangler/) | Build, dev & deploy toolchain |
| [GitHub Actions](https://github.com/features/actions) | CI/CD pipeline |

<br />

## 📄 License

This project is licensed under the [MIT License](LICENSE).

<br />

---

<div align="center">

**Built with ❤️ on the edge**

[⬆ Back to Top](#-exchange-rate-api)

</div>
]]>
