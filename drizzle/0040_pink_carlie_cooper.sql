ALTER TYPE "public"."event_email_preference" ADD VALUE 'custom';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "event_invite_email" text;