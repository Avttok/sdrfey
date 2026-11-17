ALTER TABLE "deal_quotes" ADD COLUMN "icms_cents" integer;--> statement-breakpoint
ALTER TABLE "deal_quotes" ADD COLUMN "net_cents" integer;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "net_value_cents" integer;--> statement-breakpoint
UPDATE "deal_quotes" q SET "icms_cents" = coalesce((SELECT sum(i."icms_cents") FROM "deal_quote_items" i WHERE i."quote_id" = q."id"), 0);
--> statement-breakpoint
UPDATE "deal_quotes" SET "net_cents" = "total_cents" - coalesce("ipi_cents", 0) - coalesce("icms_cents", 0) WHERE "total_cents" IS NOT NULL;
--> statement-breakpoint
UPDATE "deals" d SET "net_value_cents" = (SELECT q."net_cents" FROM "deal_quotes" q WHERE q."deal_id" = d."id" ORDER BY q."id" DESC LIMIT 1);
