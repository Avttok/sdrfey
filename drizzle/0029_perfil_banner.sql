ALTER TABLE "users" ADD COLUMN "banner" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_done" boolean DEFAULT false NOT NULL;