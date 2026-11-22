CREATE TABLE "egg_notes" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"color" text DEFAULT 'amarelo' NOT NULL,
	"sticker" text DEFAULT 'estrela' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "egg_notes" ADD CONSTRAINT "egg_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;