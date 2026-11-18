ALTER TABLE "visits" ADD COLUMN "kind" text DEFAULT 'rep' NOT NULL;--> statement-breakpoint
ALTER TABLE "visits" ADD COLUMN "seller_id" integer;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;