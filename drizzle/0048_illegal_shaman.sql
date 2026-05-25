CREATE TYPE "public"."group_member_role" AS ENUM('member', 'manager');--> statement-breakpoint
ALTER TABLE "users_to_groups" ADD COLUMN "role" "group_member_role" DEFAULT 'member' NOT NULL;