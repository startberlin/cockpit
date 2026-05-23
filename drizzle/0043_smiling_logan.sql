DROP INDEX "audit_log_category_idx";--> statement-breakpoint
CREATE INDEX "audit_log_category_created_at_idx" ON "audit_log" USING btree ("category","created_at");