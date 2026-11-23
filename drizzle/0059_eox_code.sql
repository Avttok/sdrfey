ALTER TABLE "leads" ADD COLUMN "eox_code" text;--> statement-breakpoint
UPDATE "leads" SET "eox_id" = substring("eox_url" from 'record=([0-9]+)') WHERE "eox_id" IS NULL AND "eox_url" ~ 'record=[0-9]+';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_eox_id_idx" ON "leads" ("eox_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_sf_id_idx" ON "leads" ("sf_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_eox_code_idx" ON "leads" ("eox_code");
