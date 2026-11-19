CREATE TABLE "achievement_overrides" (
	"user_id" integer NOT NULL,
	"key" text NOT NULL,
	"granted" boolean NOT NULL,
	"by" integer,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "achievement_overrides_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
ALTER TABLE "achievement_overrides" ADD CONSTRAINT "achievement_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achievement_overrides" ADD CONSTRAINT "achievement_overrides_by_users_id_fk" FOREIGN KEY ("by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;