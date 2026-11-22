CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
DROP INDEX "sessions_lead_idx";--> statement-breakpoint
DROP INDEX "deals_lead_idx";--> statement-breakpoint
DROP INDEX "interactions_lead_idx";--> statement-breakpoint
CREATE INDEX "lead_channels_value_trgm" ON "lead_channels" USING gin ("value" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "lead_people_name_trgm" ON "lead_people" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "leads_company_trgm" ON "leads" USING gin ("company" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "leads_trade_trgm" ON "leads" USING gin ("trade_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "leads_city_trgm" ON "leads" USING gin ("city" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "leads_updated_idx" ON "leads" USING btree ("updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "leads_return_idx" ON "leads" USING btree ("return_at") WHERE return_at is not null;--> statement-breakpoint
CREATE INDEX "leads_batch_idx" ON "leads" USING btree ("import_batch_id") WHERE import_batch_id is not null;--> statement-breakpoint
CREATE INDEX "leads_sort_idx" ON "leads" USING btree ("next_eligible_at") WHERE not is_test and locked_by is null;--> statement-breakpoint
CREATE INDEX "sessions_lead_idx" ON "attendance_sessions" USING btree ("lead_id","user_id","shown_at");--> statement-breakpoint
CREATE INDEX "deals_lead_idx" ON "deals" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "interactions_lead_idx" ON "interactions" USING btree ("lead_id","at");
