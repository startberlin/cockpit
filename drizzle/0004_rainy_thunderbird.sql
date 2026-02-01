ALTER TYPE "public"."role" ADD VALUE 'department_lead' BEFORE 'admin';--> statement-breakpoint
ALTER TABLE "department" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "department" CASCADE;--> statement-breakpoint
CREATE TYPE "public"."department" AS ENUM('partnerships', 'operations', 'community', 'growth', 'events');--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "department" "department";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "department_id";
