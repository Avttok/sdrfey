ALTER TABLE "deals" ADD COLUMN "freight" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "sap_code" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "order_number" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "quote_number" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "quote_date" date;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "closed_on" date;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "closed_value_cents" integer;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "payment_terms" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "is_reactivation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "seller_goals" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "deals" SET "closed_value_cents" = "value_cents", "closed_on" = ("closed_at" AT TIME ZONE 'America/Sao_Paulo')::date WHERE "stage" = 'ganho';
