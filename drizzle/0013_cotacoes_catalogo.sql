CREATE TABLE "deal_quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer NOT NULL,
	"number" text,
	"quote_date" date,
	"total_cents" integer,
	"products_cents" integer,
	"ipi_cents" integer,
	"freight_cents" integer,
	"freight" text,
	"payment_terms" text,
	"validity_days" integer,
	"note" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_terms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_terms_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"kind" text,
	"unit" text,
	"last_unit_cents" integer,
	"seen_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "deal_quote_items" ADD COLUMN "quote_id" integer;--> statement-breakpoint
ALTER TABLE "deal_quotes" ADD CONSTRAINT "deal_quotes_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_quotes" ADD CONSTRAINT "deal_quotes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_quotes_deal_idx" ON "deal_quotes" USING btree ("deal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_quotes_number_uq" ON "deal_quotes" USING btree ("deal_id","number") WHERE number is not null;--> statement-breakpoint
CREATE INDEX "products_desc_idx" ON "products" USING btree ("description");--> statement-breakpoint
ALTER TABLE "deal_quote_items" ADD CONSTRAINT "deal_quote_items_quote_id_deal_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."deal_quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "deal_quotes" ("deal_id","number","quote_date","total_cents","freight","payment_terms","created_at")
SELECT id, quote_number, quote_date, value_cents, freight, payment_terms, coalesce(quote_sent_at, created_at) FROM deals WHERE value_cents IS NOT NULL OR quote_number IS NOT NULL;
--> statement-breakpoint
UPDATE "deal_quote_items" i SET quote_id = q.id FROM "deal_quotes" q WHERE q.deal_id = i.deal_id AND q.number IS NOT DISTINCT FROM i.quote_number;
--> statement-breakpoint
INSERT INTO "payment_terms" ("name") SELECT DISTINCT payment_terms FROM deals WHERE payment_terms IS NOT NULL AND payment_terms <> '' ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "products" ("code","description","kind","unit","last_unit_cents") SELECT DISTINCT ON (product_code) product_code, description, kind, unit, unit_cents FROM deal_quote_items ORDER BY product_code, id DESC ON CONFLICT DO NOTHING;
