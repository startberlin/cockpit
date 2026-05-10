CREATE TYPE "public"."membership_application_status" AS ENUM('draft', 'submitted');--> statement-breakpoint
ALTER TABLE "membership_application" ALTER COLUMN "street" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_application" ALTER COLUMN "city" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_application" ALTER COLUMN "state" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_application" ALTER COLUMN "zip" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_application" ALTER COLUMN "country" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_application" ALTER COLUMN "declarations" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_application" ALTER COLUMN "fee_text_version" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_application" ALTER COLUMN "application_version" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_application" ALTER COLUMN "submitted_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "membership_application" ALTER COLUMN "submitted_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_application" ADD COLUMN "status" "membership_application_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_application" ADD COLUMN "personal_email" text;--> statement-breakpoint
ALTER TABLE "membership_application" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "membership_application" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_application" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;