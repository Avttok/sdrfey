ALTER TABLE "users" ADD COLUMN "daily_goal_scheduled" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "goal_attended_on" boolean;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "goal_scheduled_on" boolean;