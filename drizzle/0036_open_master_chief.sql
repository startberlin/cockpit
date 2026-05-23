CREATE TYPE "public"."membership_transition_reason" AS ENUM('resigned', 'removed_by_board');--> statement-breakpoint
CREATE TYPE "public"."membership_transition_status" AS ENUM('pending', 'acknowledged', 'retracted', 'expired', 'executed');--> statement-breakpoint
CREATE TYPE "public"."membership_transition_type" AS ENUM('cancellation', 'alumni_request', 'supporting_alumni_request');--> statement-breakpoint
ALTER TYPE "public"."user_status" ADD VALUE 'cancelled';--> statement-breakpoint
CREATE TABLE "membership_transition_request" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "membership_transition_type" NOT NULL,
	"status" "membership_transition_status" DEFAULT 'pending' NOT NULL,
	"reason" "membership_transition_reason",
	"keep_personal_email" boolean,
	"personal_email_for_notification" text,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp,
	"decided_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "personal_email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_transition_request" ADD CONSTRAINT "membership_transition_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_transition_request" ADD CONSTRAINT "membership_transition_request_decided_by_user_id_user_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;