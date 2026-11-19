CREATE TABLE "enrich_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"origin" text NOT NULL,
	"ok" boolean NOT NULL,
	"ms" integer DEFAULT 0 NOT NULL,
	"user_id" integer,
	"status" text,
	"phones" integer DEFAULT 0 NOT NULL,
	"emails" integer DEFAULT 0 NOT NULL,
	"why" text
);
--> statement-breakpoint
ALTER TABLE "enrich_log" ADD CONSTRAINT "enrich_log_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrich_log" ADD CONSTRAINT "enrich_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enrich_log_at_idx" ON "enrich_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "enrich_log_lead_idx" ON "enrich_log" USING btree ("lead_id");