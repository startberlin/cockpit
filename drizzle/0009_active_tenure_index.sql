DROP INDEX "legal_membership_active_tenure_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "legal_membership_active_tenure_idx" ON "legal_membership" USING btree ("user_id") WHERE "legal_membership"."status" IN ('admission_pending', 'application_pending', 'membership_reconfirmation_pending', 'processing', 'active');
