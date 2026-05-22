ALTER TABLE "user" ALTER COLUMN "department" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user_organization_position" ALTER COLUMN "department" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."department";--> statement-breakpoint
UPDATE "user" SET "department" = 'people' WHERE "department" = 'community';--> statement-breakpoint
UPDATE "user_organization_position" SET "department" = 'people' WHERE "department" = 'community';--> statement-breakpoint
CREATE TYPE "public"."department" AS ENUM('partnerships', 'operations', 'people', 'growth', 'events');--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "department" SET DATA TYPE "public"."department" USING "department"::"public"."department";--> statement-breakpoint
ALTER TABLE "user_organization_position" ALTER COLUMN "department" SET DATA TYPE "public"."department" USING "department"::"public"."department";