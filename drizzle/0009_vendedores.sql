CREATE TABLE "deal_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer NOT NULL,
	"user_id" integer,
	"kind" text NOT NULL,
	"note" text,
	"value_cents" integer,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"sdr_id" integer,
	"seller_id" integer,
	"stage" text DEFAULT 'novo' NOT NULL,
	"handoff_note" text,
	"value_cents" integer,
	"quote_sent_at" timestamp with time zone,
	"last_contact_at" timestamp with time zone,
	"next_action_at" timestamp with time zone,
	"next_action_note" text,
	"lost_reason" text,
	"claimed_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"is_test" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "salesforce_url" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "eox_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "seller_goal_contacts" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "seller_goal_sales" integer;--> statement-breakpoint
ALTER TABLE "visits" ADD COLUMN "status" text DEFAULT 'pendente' NOT NULL;--> statement-breakpoint
ALTER TABLE "visits" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "visits" ADD COLUMN "confirmed_by" integer;--> statement-breakpoint
ALTER TABLE "deal_events" ADD CONSTRAINT "deal_events_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_events" ADD CONSTRAINT "deal_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_sdr_id_users_id_fk" FOREIGN KEY ("sdr_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_events_deal_idx" ON "deal_events" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "deal_events_at_idx" ON "deal_events" USING btree ("at");--> statement-breakpoint
CREATE INDEX "deals_lead_idx" ON "deals" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "deals_seller_idx" ON "deals" USING btree ("seller_id","stage");--> statement-breakpoint
CREATE UNIQUE INDEX "deals_one_open_per_lead" ON "deals" USING btree ("lead_id") WHERE stage not in ('ganho','perdido');--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "visits" SET "status" = 'cancelada' WHERE "canceled_at" IS NOT NULL;
