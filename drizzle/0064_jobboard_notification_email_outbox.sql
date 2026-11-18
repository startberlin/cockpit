ALTER TABLE "jobboard_submission_notification" ADD COLUMN "email_status" text;--> statement-breakpoint
ALTER TABLE "jobboard_submission_notification" ADD COLUMN "email_next_action_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobboard_submission_notification" ADD COLUMN "email_claim_token" text;--> statement-breakpoint
ALTER TABLE "jobboard_submission_notification" ADD COLUMN "email_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "jobboard_notification_email_due_idx" ON "jobboard_submission_notification" USING btree ("email_status","email_next_action_at","user_id","submission_id") WHERE "jobboard_submission_notification"."email_status" IN ('pending', 'sending');--> statement-breakpoint
ALTER TABLE "jobboard_submission_notification" ADD CONSTRAINT "jobboard_notification_email_state_check" CHECK ("jobboard_submission_notification"."email_attempts" >= 0 AND CASE
        WHEN "jobboard_submission_notification"."email_status" = 'pending' THEN "jobboard_submission_notification"."email_next_action_at" IS NOT NULL AND "jobboard_submission_notification"."email_claim_token" IS NULL
        WHEN "jobboard_submission_notification"."email_status" = 'sending' THEN "jobboard_submission_notification"."email_next_action_at" IS NOT NULL AND "jobboard_submission_notification"."email_claim_token" IS NOT NULL
        WHEN "jobboard_submission_notification"."email_status" IS NULL OR "jobboard_submission_notification"."email_status" IN ('accepted', 'uncertain', 'rejected', 'disabled', 'skipped', 'exhausted') THEN "jobboard_submission_notification"."email_next_action_at" IS NULL AND "jobboard_submission_notification"."email_claim_token" IS NULL
        ELSE FALSE END);