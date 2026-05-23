ALTER TABLE "group" ADD COLUMN "slack_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "group" ADD COLUMN "slack_channel_id" text;--> statement-breakpoint
ALTER TABLE "group" ADD COLUMN "email_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "group" ADD COLUMN "google_group_email" text;