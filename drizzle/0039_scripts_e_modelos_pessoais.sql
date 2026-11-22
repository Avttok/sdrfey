CREATE TABLE "scripts" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer,
	"seed_key" text,
	"title" text NOT NULL,
	"segment" text DEFAULT 'geral' NOT NULL,
	"goal" text DEFAULT 'sdr' NOT NULL,
	"summary" text,
	"nodes" jsonb NOT NULL,
	"start_id" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scripts_seed_key_unique" UNIQUE("seed_key")
);
--> statement-breakpoint
ALTER TABLE "email_templates" ADD COLUMN "owner_id" integer;--> statement-breakpoint
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;