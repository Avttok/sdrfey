ALTER TABLE "users" ADD COLUMN "nav_layout" text DEFAULT 'top' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "nav_order" text[] DEFAULT ARRAY[]::text[] NOT NULL;