# Anshul Stocks - AI Investment Mentor Platform (Sprint 5.5)

> **Mission**: Build an AI Investment Mentor that helps users understand stocks, IPOs, and portfolios through natural conversations and screenshot analysis.

---

## Sprint 5.5 Real Market Data Integration & Data Pipeline

Sprint 5.5 replaces all mock provider dictionaries with **real financial data providers**, an intent-driven **Tool Router**, a resilient **ProviderManager** with fallback routing and retries, **DTO Mappers**, and a **PostgreSQL Caching Layer**.

---

## Target Architecture & Data Flow

```
User
 │
 ▼
AI Chat (Chat.tsx)
 │
 ▼
Intent Detector (intent-detector.ts)
 │
 ▼
Tool Router (tool.router.ts)
 │
 ▼
Financial Tools (stock, financial, ipo, news, calculator tools)
 │
 ▼
Provider Manager (provider.manager.ts)
 │
 ├── Market Provider (TwelveData / Live Stream)
 ├── Financial Provider (Live Income Statements)
 ├── IPO Provider (Live DRHP / Prospectus Tracker)
 └── News Provider (Live Financial News Feed)
       │
       ▼
Normalization Layer (MarketMapper, FinancialMapper, IPOMapper, NewsMapper)
       │
       ▼
PostgreSQL Cache (provider_cache & Drizzle DB tables)
       │
       ▼
Prompt Builder (prompt.builder.ts)
       │
       ▼
OpenAI GPT-5.5 / GPT-4o
       │
       ▼
Explainable AI Response
```

---

## Key Data Pipeline Components

### 1. Provider Manager (`backend/src/providers/provider.manager.ts`)
- Dynamically routes requests based on environment configuration (`MARKET_PROVIDER`, `FINANCIAL_PROVIDER`, `IPO_PROVIDER`, `NEWS_PROVIDER`).
- Handles automatic fallback if the primary provider fails.
- Runs periodic health checks (`checkHealth()`).
- Performs exponential backoff retries (`PROVIDER_RETRY_COUNT=3`).
- Logs telemetry and execution latency into the PostgreSQL `provider_requests` table.

### 2. Normalization Layer & DTO Mappers (`backend/src/providers/mappers/`)
Maps all raw external API responses into standardized internal DTO contracts before reaching the AI:
- **`MarketMapper`**: Produces `MarketQuoteDTO` and `CompanyProfileDTO`.
- **`FinancialMapper`**: Produces `FinancialMetricDTO` (Revenue, Net Profit, EPS, Book Value, PE, PB, ROE, ROCE, D/E, Margins, Cash Flow).
- **`IPOMapper`**: Produces `IPODataDTO` (Price Band, Lot Size, Issue Size, Quotas, Subscriptions, GMP, Dates).
- **`NewsMapper`**: Produces `NewsArticleDTO` (Headline, Summary, Source, URL, Date, Sentiment).

### 3. PostgreSQL Cache & Sync Pipeline (`backend/src/providers/sync/`)
- Two-tier caching combining in-memory cache and persistent `provider_cache` PostgreSQL database table.
- Cache entries store `providerSource`, `cacheKey`, `payload` JSON, `fetchedAt`, `expiresAt`, and `status`.
- **Sync Services**: `CompanySyncService`, `FinancialSyncService`, `IpoSyncService`, `NewsSyncService`.
- Checks PostgreSQL cache first. On cache miss: queries `ProviderManager`, maps via DTO Mappers, saves to PostgreSQL, and returns normalized DTO.

---

## How to Add a New Data Provider

1. **Create Provider Class**: Implement the corresponding provider interface (`IMarketProvider`, `IFinancialProvider`, `IIpoProvider`, or `INewsProvider`) under `backend/src/providers/`.
2. **Add Mapper**: Create a Mapper class in `backend/src/providers/mappers/` to map your new provider's raw HTTP response into standard DTOs.
3. **Register in `ProviderManager`**: Add your provider to `ProviderManager`'s fallback routing map in `provider.manager.ts`.
4. **Register in NestJS Module**: Export your provider from `ProvidersModule` in `providers.module.ts`.
5. **Update Environment**: Set `MARKET_PROVIDER=your_provider_name` in `backend/.env`.

---

## Environment Configuration

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/anshul_stocks
JWT_SECRET=supersecretjwtkeyforanshulstocksapplication2026

# OpenAI GPT-5.5 Config
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5.5
MAX_CONTEXT_MESSAGES=20

# Real Data Pipeline Config
TWELVE_DATA_API_KEY=b6aff7dd6dea42e4b43a1e04dd1e8d31
MARKET_PROVIDER=twelvedata
FINANCIAL_PROVIDER=twelvedata
IPO_PROVIDER=twelvedata
NEWS_PROVIDER=twelvedata
CACHE_TTL_SECONDS=3600
PROVIDER_TIMEOUT_MS=10000
PROVIDER_RETRY_COUNT=3
```

---

## Quick Start

### 1. Run Backend Server
```bash
cd backend
npm run start:dev
```

### 2. Run Integration Tests
```bash
cd backend
npm test
```

### 3. Run Frontend Client
```bash
cd frontend
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser.
