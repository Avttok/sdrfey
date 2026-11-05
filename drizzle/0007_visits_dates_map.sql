ALTER TABLE "users" ADD COLUMN "map_mode" text DEFAULT 'map' NOT NULL;--> statement-breakpoint
ALTER TABLE "visits" ADD COLUMN "visit_date" date;