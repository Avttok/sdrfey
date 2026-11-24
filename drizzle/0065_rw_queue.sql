ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "rw_checked_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_rw_queue_idx" ON "leads" USING btree ("id") WHERE rw_checked_at is null and receitaws_data is null and brasilapi_data is not null;
