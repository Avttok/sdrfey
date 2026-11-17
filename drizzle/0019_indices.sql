DROP INDEX "deal_events_deal_idx";--> statement-breakpoint
CREATE INDEX "sessions_saved_idx" ON "attendance_sessions" USING btree ("saved_at");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity","at");--> statement-breakpoint
CREATE INDEX "chat_messages_user_idx" ON "chat_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "deal_events_user_idx" ON "deal_events" USING btree ("user_id","at");--> statement-breakpoint
CREATE INDEX "deal_quote_items_quote_idx" ON "deal_quote_items" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "deals_sdr_idx" ON "deals" USING btree ("sdr_id");--> statement-breakpoint
CREATE INDEX "deals_updated_idx" ON "deals" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "deals_claimed_idx" ON "deals" USING btree ("claimed_at");--> statement-breakpoint
CREATE INDEX "leads_unenriched_idx" ON "leads" USING btree ("id") WHERE not is_test and enriched_at is null;--> statement-breakpoint
CREATE INDEX "leads_uf_idx" ON "leads" USING btree ("uf");--> statement-breakpoint
CREATE INDEX "visits_user_idx" ON "visits" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "visits_rep_idx" ON "visits" USING btree ("rep_sap");--> statement-breakpoint
CREATE INDEX "visits_pending_idx" ON "visits" USING btree ("created_at") WHERE status = 'pendente' and canceled_at is null;--> statement-breakpoint
CREATE INDEX "deal_events_deal_idx" ON "deal_events" USING btree ("deal_id","at");