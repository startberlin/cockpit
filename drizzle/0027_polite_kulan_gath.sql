CREATE TYPE "public"."event_email_preference" AS ENUM('personal_email', 'start_email');--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "event_email_preference" "event_email_preference";