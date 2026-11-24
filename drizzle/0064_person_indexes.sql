CREATE INDEX IF NOT EXISTS "lead_channels_person_idx" ON "lead_channels" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_facts_person_idx" ON "lead_facts" USING btree ("person_id");
