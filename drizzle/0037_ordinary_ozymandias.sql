CREATE TYPE "public"."membership_cancellation_status" AS ENUM('draft', 'submitted');--> statement-breakpoint
CREATE TABLE "membership_cancellation" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "membership_transition_type",
	"status" "membership_cancellation_status" DEFAULT 'draft' NOT NULL,
	"keep_personal_email" boolean,
	"personal_email_for_notification" text,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "membership_cancellation" ADD CONSTRAINT "membership_cancellation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;