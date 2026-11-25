CREATE TABLE IF NOT EXISTS "lead_tag_hits" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL REFERENCES "leads"("id") ON DELETE cascade,
	"tag_id" integer NOT NULL REFERENCES "tags"("id") ON DELETE cascade,
	"user_id" integer REFERENCES "users"("id") ON DELETE set null,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_tag_hits_lead_idx" ON "lead_tag_hits" USING btree ("lead_id","tag_id");--> statement-breakpoint
INSERT INTO "lead_tag_hits" ("lead_id","tag_id","user_id","at") SELECT lt."lead_id", lt."tag_id", lt."applied_by", lt."applied_at" FROM "lead_tags" lt WHERE lt."source" = 'manual';
