DROP TABLE "group_criteria" CASCADE;--> statement-breakpoint
ALTER TABLE "users_to_groups" DROP COLUMN "source";--> statement-breakpoint
DROP TYPE "public"."group_membership_source";