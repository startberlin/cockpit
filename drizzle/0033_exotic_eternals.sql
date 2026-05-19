DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'none' AND enumtypid = 'public.department'::regtype) THEN ALTER TYPE "public"."department" ADD VALUE 'none' BEFORE 'partnerships'; END IF; END $$;--> statement-breakpoint
COMMIT;--> statement-breakpoint
BEGIN;--> statement-breakpoint
ALTER TABLE "audit_log" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admission_participant" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "board_resolution" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "board_vote" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "legal_document" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "task" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "audit_log" CASCADE;--> statement-breakpoint
DROP TABLE "admission_participant" CASCADE;--> statement-breakpoint
DROP TABLE "board_resolution" CASCADE;--> statement-breakpoint
DROP TABLE "board_vote" CASCADE;--> statement-breakpoint
DROP TABLE "legal_document" CASCADE;--> statement-breakpoint
DROP TABLE "task" CASCADE;--> statement-breakpoint
ALTER TABLE "user_access_grant" DROP CONSTRAINT "user_grant_scope_department_unique";--> statement-breakpoint
ALTER TABLE "user_organization_position" DROP CONSTRAINT "user_position_scope_department_unique";--> statement-breakpoint
ALTER TABLE "email_suppression" DROP CONSTRAINT "email_suppression_email_unique";--> statement-breakpoint
ALTER TABLE "user_access_grant" DROP CONSTRAINT "user_access_grant_valid_scope_check";--> statement-breakpoint
ALTER TABLE "user_organization_position" DROP CONSTRAINT "user_organization_position_valid_scope_check";--> statement-breakpoint
ALTER TABLE "user_access_grant" ALTER COLUMN "department" SET DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "user_access_grant" ALTER COLUMN "department" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_organization_position" ALTER COLUMN "department" SET DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "user_organization_position" ALTER COLUMN "department" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_access_grant" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "user_organization_position" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "email_suppression" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "email_suppression" ADD PRIMARY KEY ("email");--> statement-breakpoint
ALTER TABLE "user_access_grant" ADD CONSTRAINT "user_access_grant_user_id_grant_scope_department_pk" PRIMARY KEY("user_id","grant","scope","department");--> statement-breakpoint
ALTER TABLE "user_organization_position" ADD CONSTRAINT "user_organization_position_user_id_position_scope_department_pk" PRIMARY KEY("user_id","position","scope","department");--> statement-breakpoint
ALTER TABLE "legal_membership" ADD COLUMN "board_resolution_text" text;--> statement-breakpoint
ALTER TABLE "legal_membership" ADD COLUMN "board_resolution_hash" text;--> statement-breakpoint
ALTER TABLE "legal_membership" ADD COLUMN "board_participants" jsonb;--> statement-breakpoint
ALTER TABLE "legal_membership" ADD COLUMN "board_votes" jsonb;--> statement-breakpoint
ALTER TABLE "user_access_grant" ADD CONSTRAINT "user_access_grant_valid_scope_check" CHECK ((
        "user_access_grant"."scope" = 'global' AND "user_access_grant"."department" = 'none'
      ));--> statement-breakpoint
ALTER TABLE "user_organization_position" ADD CONSTRAINT "user_organization_position_valid_scope_check" CHECK ((
        ("user_organization_position"."position" IN ('president', 'vice_president', 'head_of_finance') AND "user_organization_position"."scope" = 'global' AND "user_organization_position"."department" = 'none')
        OR ("user_organization_position"."position" = 'department_head' AND "user_organization_position"."scope" = 'department' AND "user_organization_position"."department" != 'none')
      ));--> statement-breakpoint
DROP TYPE "public"."board_vote_value";--> statement-breakpoint
DROP TYPE "public"."officer_function";--> statement-breakpoint
DROP TYPE "public"."task_status";
