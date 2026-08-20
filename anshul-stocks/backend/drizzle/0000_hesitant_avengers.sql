CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" varchar(50) NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"exchange" varchar(50) NOT NULL,
	"sector" varchar(255),
	"industry" varchar(255),
	"market_cap" numeric(18, 2),
	"isin" varchar(50),
	"website" varchar(255),
	"description" text,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "financials" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"revenue" numeric(15, 2),
	"profit" numeric(15, 2),
	"eps" numeric(10, 4),
	"roe" numeric(6, 2),
	"roce" numeric(6, 2),
	"pe" numeric(10, 2),
	"pb" numeric(10, 2),
	"debt" numeric(15, 2),
	"book_value" numeric(12, 2),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ipo" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"symbol" varchar(50),
	"price_band" varchar(255),
	"lot_size" integer,
	"issue_size" numeric(15, 2),
	"open_date" date,
	"close_date" date,
	"listing_date" date,
	"status" varchar(50) DEFAULT 'upcoming' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"title" varchar(500) NOT NULL,
	"summary" text,
	"source" varchar(255),
	"url" text,
	"published_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"open" numeric(12, 4) NOT NULL,
	"high" numeric(12, 4) NOT NULL,
	"low" numeric(12, 4) NOT NULL,
	"close" numeric(12, 4) NOT NULL,
	"current_price" numeric(12, 4) NOT NULL,
	"volume" numeric(18, 0) NOT NULL,
	"price_date" date NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "financials" ADD CONSTRAINT "financials_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sector_idx" ON "companies" USING btree ("sector");--> statement-breakpoint
CREATE INDEX "industry_idx" ON "companies" USING btree ("industry");--> statement-breakpoint
CREATE INDEX "exchange_idx" ON "companies" USING btree ("exchange");--> statement-breakpoint
CREATE INDEX "status_idx" ON "companies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fin_company_id_idx" ON "financials" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ipo_symbol_idx" ON "ipo" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "ipo_status_idx" ON "ipo" USING btree ("status");--> statement-breakpoint
CREATE INDEX "news_company_id_idx" ON "news" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "news_published_at_idx" ON "news" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "price_company_id_idx" ON "prices" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "price_date_idx" ON "prices" USING btree ("price_date");