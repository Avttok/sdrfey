CREATE TABLE "lead_list_items" (
	"lead_id" integer PRIMARY KEY NOT NULL,
	"list_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_lists" ADD COLUMN "shared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lead_list_items" ADD CONSTRAINT "lead_list_items_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_list_items" ADD CONSTRAINT "lead_list_items_list_id_lead_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lead_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_list_items_list_idx" ON "lead_list_items" USING btree ("list_id");