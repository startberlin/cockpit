ALTER TYPE "public"."organization_position" ADD VALUE 'department_co_lead';--> statement-breakpoint
COMMIT;--> statement-breakpoint
BEGIN;--> statement-breakpoint
ALTER TABLE "user_organization_position" DROP CONSTRAINT "user_organization_position_valid_scope_check";--> statement-breakpoint
ALTER TABLE "user_organization_position" ADD CONSTRAINT "user_organization_position_valid_scope_check" CHECK ((
        ("user_organization_position"."position" IN ('president', 'vice_president', 'head_of_finance') AND "user_organization_position"."scope" = 'global' AND "user_organization_position"."department" IS NULL)
        OR ("user_organization_position"."position" IN ('department_head', 'department_co_lead') AND "user_organization_position"."scope" = 'department' AND "user_organization_position"."department" IS NOT NULL)
      ));