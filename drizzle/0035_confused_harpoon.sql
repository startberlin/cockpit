-- Drop check constraints before any structural changes
ALTER TABLE "user_access_grant" DROP CONSTRAINT "user_access_grant_valid_scope_check";--> statement-breakpoint
ALTER TABLE "user_organization_position" DROP CONSTRAINT "user_organization_position_valid_scope_check";--> statement-breakpoint
-- Drop the old composite PK so department can become nullable (IF EXISTS for idempotency)
ALTER TABLE "user_organization_position" DROP CONSTRAINT IF EXISTS "user_organization_position_user_id_position_scope_department_pk";--> statement-breakpoint
ALTER TABLE "user_organization_position" ALTER COLUMN "department" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user_organization_position" ALTER COLUMN "department" DROP NOT NULL;--> statement-breakpoint
-- Convert to text to safely update data before the enum type change
ALTER TABLE "user" ALTER COLUMN "department" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user_organization_position" ALTER COLUMN "department" SET DATA TYPE text;--> statement-breakpoint
-- Replace 'none' sentinel values with NULL (data migration)
UPDATE "user_organization_position" SET "department" = NULL WHERE "department" = 'none';--> statement-breakpoint
-- Rebuild the department enum without 'none'
DROP TYPE "public"."department";--> statement-breakpoint
CREATE TYPE "public"."department" AS ENUM('partnerships', 'operations', 'community', 'growth', 'events');--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "department" SET DATA TYPE "public"."department" USING "department"::"public"."department";--> statement-breakpoint
ALTER TABLE "user_organization_position" ALTER COLUMN "department" SET DATA TYPE "public"."department" USING "department"::"public"."department";--> statement-breakpoint
-- Simplify user_access_grant: drop scope-based PK, drop scope column
ALTER TABLE "user_access_grant" DROP CONSTRAINT "user_access_grant_user_id_grant_scope_pk";--> statement-breakpoint
ALTER TABLE "user_access_grant" ADD CONSTRAINT "user_access_grant_user_id_grant_pk" PRIMARY KEY("user_id","grant");--> statement-breakpoint
ALTER TABLE "user_access_grant" DROP COLUMN "scope";--> statement-breakpoint
-- New PK and check constraint for user_organization_position
ALTER TABLE "user_organization_position" ADD CONSTRAINT "user_organization_position_user_id_position_scope_pk" PRIMARY KEY("user_id","position","scope");--> statement-breakpoint
ALTER TABLE "user_organization_position" ADD CONSTRAINT "user_organization_position_valid_scope_check" CHECK ((
        ("user_organization_position"."position" IN ('president', 'vice_president', 'head_of_finance') AND "user_organization_position"."scope" = 'global' AND "user_organization_position"."department" IS NULL)
        OR ("user_organization_position"."position" = 'department_head' AND "user_organization_position"."scope" = 'department' AND "user_organization_position"."department" IS NOT NULL)
      ));
