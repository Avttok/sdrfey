ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "eox_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "eox_tried_at" timestamp with time zone;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "eox_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"origin" text NOT NULL,
	"ok" boolean NOT NULL,
	"ms" integer DEFAULT 0 NOT NULL,
	"user_id" integer,
	"phones" integer DEFAULT 0 NOT NULL,
	"emails" integer DEFAULT 0 NOT NULL,
	"people" integer DEFAULT 0 NOT NULL,
	"filled" integer DEFAULT 0 NOT NULL,
	"why" text
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "eox_log" ADD CONSTRAINT "eox_log_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "eox_log" ADD CONSTRAINT "eox_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eox_log_at_idx" ON "eox_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eox_log_lead_idx" ON "eox_log" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_eox_queue_idx" ON "leads" USING btree ("id") WHERE eox_checked_at is null;
