CREATE TABLE "field_defs" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"kind" text DEFAULT 'lista' NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scope" text DEFAULT 'lead' NOT NULL,
	"group_name" text DEFAULT 'Perfil de compra' NOT NULL,
	"ttl_days" integer,
	"priority" integer DEFAULT 50 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"origin" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"lead_id" integer,
	"user_id" integer,
	"event" text NOT NULL,
	"is_test" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"kind" text DEFAULT 'simnao' NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scope" text DEFAULT 'lead' NOT NULL,
	"evidence" integer DEFAULT 0 NOT NULL,
	"examples" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "field_suggestions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "lead_facts" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"person_id" integer,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"confidence" integer DEFAULT 1 NOT NULL,
	"current" boolean DEFAULT true NOT NULL,
	"source" text DEFAULT 'roteiro' NOT NULL,
	"run_id" text,
	"user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "lead_people" ADD COLUMN "role_kind" text;--> statement-breakpoint
ALTER TABLE "lead_people" ADD COLUMN "preferred_channel" text;--> statement-breakpoint
ALTER TABLE "lead_people" ADD COLUMN "best_time" text;--> statement-breakpoint
ALTER TABLE "lead_people" ADD COLUMN "status" text DEFAULT 'ativo' NOT NULL;--> statement-breakpoint
ALTER TABLE "lead_people" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lead_people" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "field_events" ADD CONSTRAINT "field_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_events" ADD CONSTRAINT "field_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_facts" ADD CONSTRAINT "lead_facts_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_facts" ADD CONSTRAINT "lead_facts_person_id_lead_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."lead_people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_facts" ADD CONSTRAINT "lead_facts_key_field_defs_key_fk" FOREIGN KEY ("key") REFERENCES "public"."field_defs"("key") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lead_facts" ADD CONSTRAINT "lead_facts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "field_events_key_idx" ON "field_events" USING btree ("key","event","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_facts_current_uq" ON "lead_facts" USING btree ("lead_id",coalesce("person_id", 0),"key") WHERE "lead_facts"."current";--> statement-breakpoint
CREATE INDEX "lead_facts_lead_idx" ON "lead_facts" USING btree ("lead_id","current");--> statement-breakpoint
CREATE INDEX "lead_facts_key_idx" ON "lead_facts" USING btree ("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_cnpj_base_idx" ON "leads" USING btree (substr("cnpj", 1, 8));
