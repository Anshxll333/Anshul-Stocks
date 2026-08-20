# Provider Coverage Matrix (Sprint 5.6 Data Integrity)

This document provides a comprehensive mapping of all Internal DTO fields to their exact External API Provider sources, endpoints, nullability policies, and calculation formulas.

---

## 1. Market Quote DTO (`MarketQuoteDTO`)

| DTO Field | External Provider Source | Endpoint / Parameter | Mapped JSON Property | Nullable? | Calculation / Formula |
|---|---|---|---|---|---|
| `symbol` | Client Request / TwelveData | User Input / Query | `symbol` | **No** | Upper-case string normalization |
| `currentPrice` | Twelve Data Quote API | `/quote?symbol={SYM}` | `close` or `price` | **Yes** | Direct numeric parse; `null` if missing |
| `open` | Twelve Data Quote API | `/quote?symbol={SYM}` | `open` | **Yes** | Direct numeric parse; `null` if missing |
| `high` | Twelve Data Quote API | `/quote?symbol={SYM}` | `high` | **Yes** | Direct numeric parse; `null` if missing |
| `low` | Twelve Data Quote API | `/quote?symbol={SYM}` | `low` | **Yes** | Direct numeric parse; `null` if missing |
| `close` | Twelve Data Quote API | `/quote?symbol={SYM}` | `close` | **Yes** | Direct numeric parse; `null` if missing |
| `volume` | Twelve Data Quote API | `/quote?symbol={SYM}` | `volume` | **Yes** | Direct numeric parse; `null` if missing |
| `change` | Twelve Data Quote API | `/quote?symbol={SYM}` | `change` | **Yes** | `currentPrice - previousClose` if provided |
| `changePercent` | Twelve Data Quote API | `/quote?symbol={SYM}` | `percent_change` | **Yes** | Direct numeric parse; `null` if missing |
| `high52w` | Twelve Data Quote API | `/quote?symbol={SYM}` | `fifty_two_week.high` | **Yes** | Direct numeric parse; `null` if missing |
| `low52w` | Twelve Data Quote API | `/quote?symbol={SYM}` | `fifty_two_week.low` | **Yes** | Direct numeric parse; `null` if missing |
| `timestamp` | Twelve Data Quote API | `/quote?symbol={SYM}` | `timestamp` | **No** | ISO 8601 string date |

---

## 2. Company Profile DTO (`CompanyProfileDTO`)

| DTO Field | External Provider Source | Endpoint / Parameter | Mapped JSON Property | Nullable? | Calculation / Formula |
|---|---|---|---|---|---|
| `symbol` | Client Request / TwelveData | User Input / Query | `symbol` | **No** | Upper-case symbol string |
| `companyName` | Twelve Data Profile API | `/profile?symbol={SYM}` | `name` | **No** | Defaults to symbol if name omitted |
| `exchange` | Twelve Data Profile API | `/profile?symbol={SYM}` | `exchange` | **No** | Defaults to 'NSE' |
| `sector` | Twelve Data Profile API | `/profile?symbol={SYM}` | `sector` | **Yes** | `null` if unsupplied |
| `industry` | Twelve Data Profile API | `/profile?symbol={SYM}` | `industry` | **Yes** | `null` if unsupplied |
| `marketCapCr` | Twelve Data Profile API | `/profile?symbol={SYM}` | `market_cap` | **Yes** | `market_cap / 10000000` (in Crores); `null` if missing |
| `high52` | Twelve Data Profile API | `/profile?symbol={SYM}` | `high52` | **Yes** | `null` if unsupplied |
| `low52` | Twelve Data Profile API | `/profile?symbol={SYM}` | `low52` | **Yes** | `null` if unsupplied |
| `volume` | Twelve Data Profile API | `/profile?symbol={SYM}` | `volume` | **Yes** | `null` if unsupplied |

---

## 3. Financial Metric DTO (`FinancialMetricDTO`)

| DTO Field | External Provider Source | Endpoint / Parameter | Mapped JSON Property | Nullable? | Calculation / Formula |
|---|---|---|---|---|---|
| `revenueCr` | Income Statement API | `/income_statement?symbol={SYM}` | `total_revenue` | **Yes** | `revenue / 10000000` (Crores); `null` if unsupplied |
| `netProfitCr` | Income Statement API | `/income_statement?symbol={SYM}` | `net_income` | **Yes** | `net_income / 10000000` (Crores); `null` if unsupplied |
| `eps` | Income Statement API | `/income_statement?symbol={SYM}` | `eps` | **Yes** | `null` if unsupplied |
| `bookValue` | Balance Sheet API | `/balance_sheet?symbol={SYM}` | `book_value` | **Yes** | `null` if unsupplied |
| `peRatio` | Key Metrics API | `/key_metrics?symbol={SYM}` | `pe_ratio` | **Yes** | `price / eps` if calculated; `null` if unsupplied |
| `pbRatio` | Key Metrics API | `/key_metrics?symbol={SYM}` | `pb_ratio` | **Yes** | `price / bookValue` if calculated; `null` if unsupplied |
| `roe` | Financial Ratios API | `/ratios?symbol={SYM}` | `roe` | **Yes** | `(netIncome / equity) * 100`; `null` if unsupplied |
| `roce` | Financial Ratios API | `/ratios?symbol={SYM}` | `roce` | **Yes** | `(ebit / capitalEmployed) * 100`; `null` if unsupplied |
| `debtToEquity` | Balance Sheet API | `/balance_sheet?symbol={SYM}` | `debt_to_equity` | **Yes** | `totalDebt / equity`; `null` if unsupplied |
| `operatingMargin` | Income Statement API | `/income_statement?symbol={SYM}` | `operating_margin` | **Yes** | `(operatingIncome / revenue) * 100`; `null` if unsupplied |
| `netMargin` | Income Statement API | `/income_statement?symbol={SYM}` | `net_margin` | **Yes** | `(netIncome / revenue) * 100`; `null` if unsupplied |

---

## 4. IPO Data DTO (`IPODataDTO`)

| DTO Field | External Provider Source | Endpoint / Parameter | Mapped JSON Property | Nullable? | Calculation / Formula |
|---|---|---|---|---|---|
| `companyName` | Exchange Prospectus Feed | Live DRHP Feed | `companyName` | **No** | Full legal corporate name |
| `symbol` | Exchange Listing Feed | Live DRHP Feed | `symbol` | **Yes** | `null` prior to listing allocation |
| `exchange` | Exchange Listing Feed | Live DRHP Feed | `exchange` | **Yes** | Defaults to 'NSE/BSE' |
| `issuePrice` | Exchange Prospectus Feed | Live DRHP Feed | `issuePrice` | **Yes** | `null` prior to price discovery |
| `priceBand` | Exchange Prospectus Feed | Live DRHP Feed | `priceBand` | **Yes** | `null` if missing |
| `lotSize` | Exchange Prospectus Feed | Live DRHP Feed | `lotSize` | **Yes** | `null` if missing |
| `issueSizeCr` | Exchange Prospectus Feed | Live DRHP Feed | `issueSize` | **Yes** | `null` if missing |
| `gmp` | Grey Market Premium Feed | Market Aggregator | `gmp` | **Yes** | `null` if unquoted |
| `totalSub` | Registrar Subscription API | Live Subscription Feed | `totalSub` | **Yes** | `null` if unquoted |

---

## 5. News Article DTO (`NewsArticleDTO`)

| DTO Field | External Provider Source | Endpoint / Parameter | Mapped JSON Property | Nullable? | Calculation / Formula |
|---|---|---|---|---|---|
| `id` | News API / RSS | `/news?symbol={SYM}` | `id` | **No** | Unique news article UUID |
| `headline` | News API / RSS | `/news?symbol={SYM}` | `headline` | **No** | Headline title text |
| `summary` | News API / RSS | `/news?symbol={SYM}` | `summary` | **Yes** | `null` if missing |
| `source` | News API / RSS | `/news?symbol={SYM}` | `source` | **No** | Financial publication name |
| `url` | News API / RSS | `/news?symbol={SYM}` | `url` | **Yes** | `null` if missing |
| `publishedAt` | News API / RSS | `/news?symbol={SYM}` | `publishedAt` | **No** | ISO 8601 timestamp string |
