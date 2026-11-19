ALTER TABLE "users" ADD COLUMN "coins_earn_blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "coins_spend_blocked" boolean DEFAULT false NOT NULL;