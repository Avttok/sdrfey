ALTER TABLE "leads" ADD COLUMN "eox_info" jsonb;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "eox_synced_at" timestamp with time zone;