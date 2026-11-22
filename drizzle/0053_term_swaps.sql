CREATE TABLE "term_swaps" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" integer,
	"from_text" text NOT NULL,
	"to_text" text NOT NULL,
	"match_case" boolean DEFAULT false NOT NULL,
	"whole_word" boolean DEFAULT false NOT NULL,
	"changes" jsonb NOT NULL,
	"rows" integer DEFAULT 0 NOT NULL,
	"undone_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "term_swaps" ADD CONSTRAINT "term_swaps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;