CREATE TABLE "contact_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"user_id" integer,
	"person_id" integer,
	"channel" text NOT NULL,
	"target" text NOT NULL,
	"outcome" text,
	"note" text,
	"duration_sec" integer,
	"run_id" text,
	"is_test" boolean DEFAULT false NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "contact_events" ADD CONSTRAINT "contact_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_events" ADD CONSTRAINT "contact_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_events" ADD CONSTRAINT "contact_events_person_id_lead_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."lead_people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_events_lead_idx" ON "contact_events" USING btree ("lead_id","at");--> statement-breakpoint
CREATE INDEX "contact_events_user_idx" ON "contact_events" USING btree ("user_id","at");--> statement-breakpoint
CREATE INDEX "contact_events_open_idx" ON "contact_events" USING btree ("user_id") WHERE outcome is null;