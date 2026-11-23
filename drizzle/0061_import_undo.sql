CREATE TABLE "import_undo" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" integer NOT NULL,
	"kind" text NOT NULL,
	"ref_id" integer NOT NULL,
	"before" jsonb
);
--> statement-breakpoint
ALTER TABLE "import_undo" ADD CONSTRAINT "import_undo_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_undo_batch_idx" ON "import_undo" USING btree ("batch_id");