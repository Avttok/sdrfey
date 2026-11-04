CREATE TABLE "attendance_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"shown_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"saved_at" timestamp with time zone,
	"outcome" text,
	"is_test" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"user_id" integer,
	"channel" text NOT NULL,
	"note" text,
	"is_test" boolean DEFAULT false NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"person_id" integer,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"label" text,
	"origin" text DEFAULT 'manual' NOT NULL,
	"wrong" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_people" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"name" text NOT NULL,
	"role_title" text,
	"extension" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_skips" (
	"lead_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"until" timestamp with time zone NOT NULL,
	CONSTRAINT "lead_skips_lead_id_user_id_pk" PRIMARY KEY("lead_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "presence" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activity" text,
	"lead_id" integer
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "brasilapi_data" jsonb;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "receitaws_data" jsonb;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "trade_name" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "is_test" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "return_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "daily_goal" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "can_manage_goals" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "permissions" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_channels" ADD CONSTRAINT "lead_channels_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_channels" ADD CONSTRAINT "lead_channels_person_id_lead_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."lead_people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_people" ADD CONSTRAINT "lead_people_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_skips" ADD CONSTRAINT "lead_skips_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_skips" ADD CONSTRAINT "lead_skips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence" ADD CONSTRAINT "presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "attendance_sessions" USING btree ("user_id","saved_at");--> statement-breakpoint
CREATE INDEX "sessions_lead_idx" ON "attendance_sessions" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "interactions_at_idx" ON "interactions" USING btree ("at");--> statement-breakpoint
CREATE INDEX "interactions_user_idx" ON "interactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "interactions_lead_idx" ON "interactions" USING btree ("lead_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_channels_uq" ON "lead_channels" USING btree ("lead_id","kind","value");--> statement-breakpoint
CREATE INDEX "lead_channels_value_idx" ON "lead_channels" USING btree ("value");--> statement-breakpoint
CREATE INDEX "lead_people_lead_idx" ON "lead_people" USING btree ("lead_id");--> statement-breakpoint
INSERT INTO lead_channels (lead_id, kind, value, origin)
SELECT l.id, 'phone', p, 'import' FROM leads l, unnest(l.phones) AS p WHERE p <> ''
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO lead_channels (lead_id, kind, value, origin)
SELECT id, 'email', lower(email), 'import' FROM leads WHERE email IS NOT NULL AND email <> ''
ON CONFLICT DO NOTHING;
