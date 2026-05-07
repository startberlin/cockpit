DROP TABLE "legal_membership" CASCADE;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "legal_membership_state" "legal_membership_state" DEFAULT 'not_member' NOT NULL;--> statement-breakpoint
DROP TYPE "public"."legal_membership_document_status";