CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"user_id" integer,
	"body" text DEFAULT '' NOT NULL,
	"share_kind" text,
	"share_id" integer,
	"share_label" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_reads" (
	"user_id" integer NOT NULL,
	"channel" text NOT NULL,
	"last_id" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "chat_reads_user_id_channel_pk" PRIMARY KEY("user_id","channel")
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_reads" ADD CONSTRAINT "chat_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_channel_idx" ON "chat_messages" USING btree ("channel","id");