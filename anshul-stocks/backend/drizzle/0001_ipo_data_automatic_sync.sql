-- ============================================================================
-- 0001_ipo_data_automatic_sync.sql
-- ----------------------------------------------------------------------------
-- Adds columns required for automatic IPO synchronization from FinAPI:
--   https://finapi.upvaly.com/api/ipo
--
-- NOTE: The original drizzle snapshot (0000) is stale relative to the live
-- database (the project is normally synced with `drizzle-kit push`). This file
-- is a safe, targeted ALTER that ONLY touches the `ipo_data` table and is safe
-- to run repeatedly (IF NOT EXISTS guards).
-- ============================================================================

-- --- Basic IPO ---
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "ipo_type" varchar(50);
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "details_url" text;
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "logo_url" text;
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "exchanges" varchar(255);

-- --- Pricing (original priceRange string is preserved; upper bound is parsed) ---
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "price_range" varchar(255);
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "issue_upper_price" numeric(12, 2);
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "total_issue_size" numeric(15, 2);
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "fresh_issue" numeric(15, 2);
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "offer_for_sale" numeric(15, 2);

-- --- Schedule ---
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "upi_mandate_deadline" varchar(50);
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "allotment_finalization" varchar(50);
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "refund_initiation" varchar(50);
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "share_credit" varchar(50);
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "mandate_end_date" varchar(50);
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "lock_in_end_date_anchor_50" varchar(50);
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "lock_in_end_date_anchor_remaining" varchar(50);

-- --- Subscription (NULL = not yet available for upcoming IPOs) ---
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "inst_reserved" numeric(12, 2);
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "inst_applied" numeric(12, 2);
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "inst_sub" numeric(8, 2);
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "nii_reserved" numeric(12, 2);
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "nii_applied" numeric(12, 2);
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "retail_reserved" numeric(12, 2);
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "retail_applied" numeric(12, 2);
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "total_reserved" numeric(12, 2);
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "total_applied" numeric(12, 2);

-- --- GMP (NULL when FinAPI has no grey market premium data) ---
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "gmp_gain_percent" numeric(8, 2);
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "gmp_date" varchar(50);
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "gmp_source" text;
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "gmp_trends" text;

-- --- Company information ---
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "about_company" text;
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "strengths" text;
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "risks" text;
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "drhp_link" text;
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "rhp_link" text;
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "utilization_of_proceeds" text;

-- --- System fields ---
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE "ipo_data" ADD COLUMN IF NOT EXISTS "last_synced_at" timestamp with time zone;

-- Backfill created_at for existing rows (kept from updated_at)
UPDATE "ipo_data" SET "created_at" = "updated_at" WHERE "created_at" IS NULL;

-- --- Unique key for UPSERT (same IPO always maps to the same record) ---
CREATE UNIQUE INDEX IF NOT EXISTS "ipo_data_symbol_unique" ON "ipo_data" ("symbol");
