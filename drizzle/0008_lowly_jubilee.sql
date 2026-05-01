ALTER TABLE "user" ADD COLUMN "google_workspace_id" text;--> statement-breakpoint
ALTER TABLE "membership_payment" ADD COLUMN "paid_through_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_google_workspace_id_unique" UNIQUE("google_workspace_id");