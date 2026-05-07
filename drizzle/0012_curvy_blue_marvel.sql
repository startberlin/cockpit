CREATE TYPE "public"."legal_membership_document_status" AS ENUM('not_required', 'verified', 'missing_or_unsure');--> statement-breakpoint
CREATE TYPE "public"."legal_membership_state" AS ENUM('not_member', 'active_member', 'former_member');--> statement-breakpoint
CREATE TYPE "public"."workflow_status" AS ENUM('open', 'completed', 'manual_followup', 'cancelled');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" text,
	"target_user_id" text,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_membership" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"state" "legal_membership_state" DEFAULT 'not_member' NOT NULL,
	"document_status" "legal_membership_document_status" DEFAULT 'missing_or_unsure' NOT NULL,
	"classified_by_user_id" text,
	"classified_at" timestamp,
	"activated_at" timestamp,
	"former_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "legal_membership_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "workflow" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"status" "workflow_status" DEFAULT 'open' NOT NULL,
	"subject_user_id" text,
	"created_by_user_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"cancelled_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_membership" ADD CONSTRAINT "legal_membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_membership" ADD CONSTRAINT "legal_membership_classified_by_user_id_user_id_fk" FOREIGN KEY ("classified_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow" ADD CONSTRAINT "workflow_subject_user_id_user_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow" ADD CONSTRAINT "workflow_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_criteria" DROP COLUMN "roles";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "roles";--> statement-breakpoint
DROP TYPE "public"."role";--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."prevent_user_delete"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION 'Users cannot be deleted; deactivate or change status instead.';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "prevent_user_delete"
BEFORE DELETE ON "public"."user"
FOR EACH ROW
EXECUTE FUNCTION "public"."prevent_user_delete"();
