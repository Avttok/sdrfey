CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"area" text DEFAULT 'sdr' NOT NULL,
	"user_id" integer NOT NULL,
	"lead_id" integer,
	"kind" text DEFAULT 'ligar' NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"due_at" timestamp with time zone,
	"done_at" timestamp with time zone,
	"run_id" text,
	"run_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_user_idx" ON "tasks" USING btree ("user_id","area","done_at","due_at");--> statement-breakpoint
CREATE INDEX "tasks_lead_idx" ON "tasks" USING btree ("lead_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_run_key_uq" ON "tasks" USING btree ("run_id","run_key");