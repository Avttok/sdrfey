CREATE TABLE "call_scripts" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"lead_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"script_id" integer,
	"script_title" text NOT NULL,
	"goal" text NOT NULL,
	"segment" text NOT NULL,
	"contact_name" text,
	"steps" jsonb NOT NULL,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"outcome" text,
	"finished" boolean DEFAULT false NOT NULL,
	"is_test" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "call_scripts" ADD CONSTRAINT "call_scripts_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_scripts" ADD CONSTRAINT "call_scripts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "call_scripts_run_uq" ON "call_scripts" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "call_scripts_lead_idx" ON "call_scripts" USING btree ("lead_id","started_at");