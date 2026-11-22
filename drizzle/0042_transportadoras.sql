CREATE TABLE "carriers" (
	"id" serial PRIMARY KEY NOT NULL,
	"uf" text NOT NULL,
	"mode" text NOT NULL,
	"name" text NOT NULL,
	"capital_pct" double precision,
	"interior_pct" double precision,
	"capital_days" integer,
	"interior_days" integer,
	"min_cents" integer,
	"contact" text,
	"note" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "carriers_uf_mode_name" ON "carriers" USING btree ("uf","mode","name");