CREATE TABLE "seller_shuffles" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"shown_at" timestamp with time zone DEFAULT now() NOT NULL,
	"outcome" text,
	"note" text,
	"deal_id" integer,
	"done_at" timestamp with time zone,
	"is_test" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deal_quotes" ADD COLUMN "outcome" text;--> statement-breakpoint
ALTER TABLE "deal_quotes" ADD COLUMN "outcome_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "kind" text DEFAULT 'prospect' NOT NULL;--> statement-breakpoint
ALTER TABLE "seller_shuffles" ADD CONSTRAINT "seller_shuffles_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_shuffles" ADD CONSTRAINT "seller_shuffles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "seller_shuffles_user_idx" ON "seller_shuffles" USING btree ("user_id","done_at");--> statement-breakpoint
CREATE INDEX "seller_shuffles_lead_idx" ON "seller_shuffles" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "leads_kind_idx" ON "leads" USING btree ("kind");