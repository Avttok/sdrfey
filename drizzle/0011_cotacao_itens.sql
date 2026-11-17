CREATE TABLE "deal_quote_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer NOT NULL,
	"quote_number" text,
	"seq" integer NOT NULL,
	"product_code" text NOT NULL,
	"client_ref" text,
	"description" text NOT NULL,
	"kind" text,
	"qty" numeric(12, 2) NOT NULL,
	"pack_qty" numeric(12, 2),
	"unit" text,
	"icms_cents" integer,
	"ipi_cents" integer,
	"unit_cents" integer,
	"total_cents" integer
);
--> statement-breakpoint
ALTER TABLE "deal_quote_items" ADD CONSTRAINT "deal_quote_items_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_quote_items_deal_idx" ON "deal_quote_items" USING btree ("deal_id");