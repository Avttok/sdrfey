ALTER TABLE "deal_quotes" ADD COLUMN "weight_kg" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "weight_kg" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "weight_kg" numeric(12, 4);