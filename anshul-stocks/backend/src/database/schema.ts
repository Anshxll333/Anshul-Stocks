import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  decimal,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Users Table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// 2. Conversations Table
export const conversations = pgTable(
  'conversations',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: varchar('title', { length: 255 })
      .notNull()
      .default('New Conversation'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    convUserIdIdx: index('conv_user_id_idx').on(table.userId),
  }),
);

// 3. Messages Table
export const messages = pgTable(
  'messages',
  {
    id: serial('id').primaryKey(),
    conversationId: integer('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' })
      .notNull(),
    role: varchar('role', { length: 50 }).notNull(), // 'user' | 'assistant' | 'system'
    content: text('content').notNull(),
    model: varchar('model', { length: 100 }), // e.g. 'mistral/mistral-small-latest'
    status: varchar('status', { length: 50 }).default('completed').notNull(),
    tokenCount: integer('token_count'),
    responseTime: integer('response_time'), // in ms
    metadata: text('metadata'), // JSON metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    msgConvIdIdx: index('msg_conv_id_idx').on(table.conversationId),
    msgStatusIdx: index('msg_status_idx').on(table.status),
  }),
);

// 4. Uploaded Files Table
export const uploadedFiles = pgTable(
  'uploaded_files',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    conversationId: integer('conversation_id').references(
      () => conversations.id,
      { onDelete: 'set null' },
    ),
    filename: varchar('filename', { length: 255 }).notNull(),
    originalName: varchar('original_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    fileType: varchar('file_type', { length: 50 })
      .default('screenshot')
      .notNull(),
    processingStatus: varchar('processing_status', { length: 50 })
      .default('pending')
      .notNull(),
    width: integer('width'),
    height: integer('height'),
    checksum: varchar('checksum', { length: 64 }),
    sizeBytes: integer('size_bytes').notNull(),
    filepath: text('filepath').notNull(),
    metadata: text('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    fileUserIdIdx: index('file_user_id_idx').on(table.userId),
    fileConvIdIdx: index('file_conv_id_idx').on(table.conversationId),
    fileStatusIdx: index('file_status_idx').on(table.processingStatus),
  }),
);

// 5. Analysis History Table
export const analysisHistory = pgTable(
  'analysis_history',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    fileId: integer('file_id').references(() => uploadedFiles.id, {
      onDelete: 'set null',
    }),
    conversationId: integer('conversation_id').references(
      () => conversations.id,
      { onDelete: 'set null' },
    ),
    analysisType: varchar('analysis_type', { length: 100 }).notNull(),
    input: text('input'),
    output: text('output'),
    result: text('result').notNull(),
    confidence: varchar('confidence', { length: 20 }),
    processingTime: integer('processing_time'),
    model: varchar('model', { length: 100 }),
    status: varchar('status', { length: 50 }).default('completed').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    analysisUserIdIdx: index('analysis_user_id_idx').on(table.userId),
    analysisTypeIdx: index('analysis_type_idx').on(table.analysisType),
  }),
);

// 6. Watchlists & Watchlist Items Tables (Normalized)
export const watchlists = pgTable(
  'watchlists',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    watchlistUserIdIdx: index('watchlist_user_id_idx').on(table.userId),
  }),
);

export const watchlistItems = pgTable(
  'watchlist_items',
  {
    id: serial('id').primaryKey(),
    watchlistId: integer('watchlist_id')
      .references(() => watchlists.id, { onDelete: 'cascade' })
      .notNull(),
    symbol: varchar('symbol', { length: 50 }).notNull(),
    notes: text('notes'),
    addedAt: timestamp('added_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    itemWatchlistIdIdx: index('item_watchlist_id_idx').on(table.watchlistId),
    itemSymbolIdx: index('item_symbol_idx').on(table.symbol),
  }),
);

// 7. Notes Table
export const notes = pgTable(
  'notes',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    noteUserIdIdx: index('note_user_id_idx').on(table.userId),
  }),
);

// --- STRUCTURED FINANCIAL & PROVIDER DATA TABLES (Sprint 5) ---

// 8. Companies Table
export const companies = pgTable(
  'companies',
  {
    id: serial('id').primaryKey(),
    symbol: varchar('symbol', { length: 50 }).notNull().unique(),
    companyName: varchar('company_name', { length: 255 }).notNull(),
    exchange: varchar('exchange', { length: 50 }).default('NSE').notNull(),
    sector: varchar('sector', { length: 255 }),
    industry: varchar('industry', { length: 255 }),
    marketCapCr: decimal('market_cap_cr', { precision: 18, scale: 2 }),
    high52: decimal('high_52', { precision: 12, scale: 2 }),
    low52: decimal('low_52', { precision: 12, scale: 2 }),
    volume: integer('volume'),
    description: text('description'),
    status: varchar('status', { length: 50 }).default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    symbolIdx: index('company_symbol_idx').on(table.symbol),
    sectorIdx: index('company_sector_idx').on(table.sector),
  }),
);

// 9. Company Profiles Table
export const companyProfiles = pgTable('company_profiles', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  website: varchar('website', { length: 255 }),
  isin: varchar('isin', { length: 50 }),
  headquarter: varchar('headquarter', { length: 255 }),
  ceo: varchar('ceo', { length: 255 }),
  employeeCount: integer('employee_count'),
  businessSummary: text('business_summary'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// 10. Financial Metrics Table
export const financialMetrics = pgTable(
  'financial_metrics',
  {
    id: serial('id').primaryKey(),
    symbol: varchar('symbol', { length: 50 }).notNull().unique(),
    revenueCr: decimal('revenue_cr', { precision: 18, scale: 2 }),
    netProfitCr: decimal('net_profit_cr', { precision: 18, scale: 2 }),
    eps: decimal('eps', { precision: 10, scale: 4 }),
    bookValue: decimal('book_value', { precision: 12, scale: 2 }),
    peRatio: decimal('pe_ratio', { precision: 10, scale: 2 }),
    pbRatio: decimal('pb_ratio', { precision: 10, scale: 2 }),
    roe: decimal('roe', { precision: 6, scale: 2 }),
    roce: decimal('roce', { precision: 6, scale: 2 }),
    debtToEquity: decimal('debt_to_equity', { precision: 8, scale: 2 }),
    currentRatio: decimal('current_ratio', { precision: 8, scale: 2 }),
    operatingMargin: decimal('operating_margin', { precision: 6, scale: 2 }),
    netMargin: decimal('net_margin', { precision: 6, scale: 2 }),
    freeCashFlowCr: decimal('free_cash_flow_cr', { precision: 18, scale: 2 }),
    enterpriseValueCr: decimal('enterprise_value_cr', {
      precision: 18,
      scale: 2,
    }),
    dividendYield: decimal('dividend_yield', { precision: 6, scale: 2 }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    finSymbolIdx: index('fin_symbol_idx').on(table.symbol),
  }),
);

// 11. Market Quotes Table
export const marketQuotes = pgTable(
  'market_quotes',
  {
    id: serial('id').primaryKey(),
    symbol: varchar('symbol', { length: 50 }).notNull().unique(),
    currentPrice: decimal('current_price', {
      precision: 12,
      scale: 2,
    }).notNull(),
    open: decimal('open', { precision: 12, scale: 2 }).notNull(),
    high: decimal('high', { precision: 12, scale: 2 }).notNull(),
    low: decimal('low', { precision: 12, scale: 2 }).notNull(),
    close: decimal('close', { precision: 12, scale: 2 }).notNull(),
    volume: integer('volume').notNull(),
    change: decimal('change', { precision: 12, scale: 2 }),
    changePercent: decimal('change_percent', { precision: 8, scale: 2 }),
    timestamp: timestamp('timestamp', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    quoteSymbolIdx: index('quote_symbol_idx').on(table.symbol),
  }),
);

// 12. IPO Data Table
export const ipoData = pgTable(
  'ipo_data',
  {
    id: serial('id').primaryKey(),
    companyName: varchar('company_name', { length: 255 }).notNull(),
    symbol: varchar('symbol', { length: 50 }).unique(),
    exchange: varchar('exchange', { length: 50 }).default('NSE/BSE'),
    ipoType: varchar('ipo_type', { length: 50 }),
    detailsUrl: text('details_url'),
    logoUrl: text('logo_url'),
    exchanges: varchar('exchanges', { length: 255 }),
    issuePrice: decimal('issue_price', { precision: 12, scale: 2 }),
    priceBand: varchar('price_band', { length: 255 }),
    priceRange: varchar('price_range', { length: 255 }),
    issueUpperPrice: decimal('issue_upper_price', { precision: 12, scale: 2 }),
    lotSize: integer('lot_size'),
    minInvestment: decimal('min_investment', { precision: 12, scale: 2 }),
    issueSizeCr: decimal('issue_size_cr', { precision: 15, scale: 2 }),
    totalIssueSize: decimal('total_issue_size', { precision: 15, scale: 2 }),
    freshIssue: decimal('fresh_issue', { precision: 15, scale: 2 }),
    offerForSale: decimal('offer_for_sale', { precision: 15, scale: 2 }),
    openDate: varchar('open_date', { length: 50 }),
    closeDate: varchar('close_date', { length: 50 }),
    listingDate: varchar('listing_date', { length: 50 }),
    upiMandateDeadline: varchar('upi_mandate_deadline', { length: 50 }),
    allotmentFinalization: varchar('allotment_finalization', { length: 50 }),
    refundInitiation: varchar('refund_initiation', { length: 50 }),
    shareCredit: varchar('share_credit', { length: 50 }),
    mandateEndDate: varchar('mandate_end_date', { length: 50 }),
    lockInEndDateAnchor50: varchar('lock_in_end_date_anchor_50', {
      length: 50,
    }),
    lockInEndDateAnchorRemaining: varchar('lock_in_end_date_anchor_remaining', {
      length: 50,
    }),
    registrar: varchar('registrar', { length: 255 }),
    retailQuota: varchar('retail_quota', { length: 100 }),
    qibQuota: varchar('qib_quota', { length: 100 }),
    niiQuota: varchar('nii_quota', { length: 100 }),
    retailSub: decimal('retail_sub', { precision: 8, scale: 2 }),
    qibSub: decimal('qib_sub', { precision: 8, scale: 2 }),
    niiSub: decimal('nii_sub', { precision: 8, scale: 2 }),
    totalSub: decimal('total_sub', { precision: 8, scale: 2 }),
    instReserved: decimal('inst_reserved', { precision: 12, scale: 2 }),
    instApplied: decimal('inst_applied', { precision: 12, scale: 2 }),
    instSub: decimal('inst_sub', { precision: 8, scale: 2 }),
    niiReserved: decimal('nii_reserved', { precision: 12, scale: 2 }),
    niiApplied: decimal('nii_applied', { precision: 12, scale: 2 }),
    retailReserved: decimal('retail_reserved', { precision: 12, scale: 2 }),
    retailApplied: decimal('retail_applied', { precision: 12, scale: 2 }),
    totalReserved: decimal('total_reserved', { precision: 12, scale: 2 }),
    totalApplied: decimal('total_applied', { precision: 12, scale: 2 }),
    gmp: decimal('gmp', { precision: 10, scale: 2 }),
    gmpGainPercent: decimal('gmp_gain_percent', { precision: 8, scale: 2 }),
    gmpDate: varchar('gmp_date', { length: 50 }),
    gmpSource: text('gmp_source'),
    gmpTrends: text('gmp_trends'), // JSON history for the AI Mentor
    listingGainPercent: decimal('listing_gain_percent', {
      precision: 8,
      scale: 2,
    }),
    status: varchar('status', { length: 50 }).default('upcoming').notNull(),
    aboutCompany: text('about_company'),
    strengths: text('strengths'), // JSON array
    risks: text('risks'), // JSON array
    drhpLink: text('drhp_link'),
    rhpLink: text('rhp_link'),
    utilizationOfProceeds: text('utilization_of_proceeds'), // JSON object
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  },
  (table) => ({
    ipoCompanyIdx: index('ipo_company_idx').on(table.companyName),
    ipoStatusIdx: index('ipo_status_idx').on(table.status),
  }),
);

// 13. News Articles Table
export const newsArticles = pgTable(
  'news_articles',
  {
    id: serial('id').primaryKey(),
    headline: text('headline').notNull(),
    summary: text('summary'),
    source: varchar('source', { length: 255 }).notNull(),
    url: text('url'),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    symbols: text('symbols'), // JSON string array of symbols
    sentiment: varchar('sentiment', { length: 50 }).default('neutral'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    newsPublishedIdx: index('news_published_idx').on(table.publishedAt),
  }),
);

// 14. Provider Cache Table
export const providerCache = pgTable(
  'provider_cache',
  {
    id: serial('id').primaryKey(),
    cacheKey: varchar('cache_key', { length: 255 }).notNull().unique(),
    providerSource: varchar('provider_source', { length: 100 }).notNull(),
    payload: text('payload').notNull(), // JSON string payload
    providerVersion: varchar('provider_version', { length: 50 }).default('v1'),
    schemaVersion: varchar('schema_version', { length: 50 }).default('v1'),
    etag: varchar('etag', { length: 255 }),
    responseHash: varchar('response_hash', { length: 64 }),
    validationStatus: varchar('validation_status', { length: 50 })
      .default('valid')
      .notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    status: varchar('status', { length: 50 }).default('valid').notNull(),
  },
  (table) => ({
    cacheKeyIdx: index('cache_key_idx').on(table.cacheKey),
    expiresAtIdx: index('cache_expires_at_idx').on(table.expiresAt),
  }),
);

// 15. Provider Requests Log Table
export const providerRequests = pgTable(
  'provider_requests',
  {
    id: serial('id').primaryKey(),
    providerName: varchar('provider_name', { length: 100 }).notNull(),
    endpoint: varchar('endpoint', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).notNull(), // 'success' | 'error' | 'cache_hit'
    latencyMs: integer('latency_ms').notNull(),
    requestId: varchar('request_id', { length: 100 }),
    timestamp: timestamp('timestamp', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    reqProviderIdx: index('req_provider_idx').on(table.providerName),
  }),
);

// Relations Definitions
export const usersRelations = relations(users, ({ many }) => ({
  conversations: many(conversations),
  uploadedFiles: many(uploadedFiles),
  analysisHistory: many(analysisHistory),
  watchlists: many(watchlists),
  notes: many(notes),
}));

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    user: one(users, {
      fields: [conversations.userId],
      references: [users.id],
    }),
    messages: many(messages),
    uploadedFiles: many(uploadedFiles),
  }),
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const watchlistsRelations = relations(watchlists, ({ one, many }) => ({
  user: one(users, {
    fields: [watchlists.userId],
    references: [users.id],
  }),
  items: many(watchlistItems),
}));

export const watchlistItemsRelations = relations(watchlistItems, ({ one }) => ({
  watchlist: one(watchlists, {
    fields: [watchlistItems.watchlistId],
    references: [watchlists.id],
  }),
}));

export const companiesRelations = relations(companies, ({ one }) => ({
  profile: one(companyProfiles, {
    fields: [companies.id],
    references: [companyProfiles.companyId],
  }),
}));
