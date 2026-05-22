CREATE TYPE "public"."member_action_type" AS ENUM('complete_application', 'reconfirm_membership', 'setup_mandate', 'fix_mandate', 'acknowledge_cancellation', 'decide_transition', 'vote_admission');--> statement-breakpoint
CREATE TABLE "member_action_reminder" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient_user_id" text NOT NULL,
	"action_type" "member_action_type" NOT NULL,
	"subject_id" text NOT NULL,
	"first_observed_at" timestamp DEFAULT now() NOT NULL,
	"last_reminder_at" timestamp DEFAULT now() NOT NULL,
	"reminder_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_action_reminder" ADD CONSTRAINT "member_action_reminder_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "member_action_reminder_uniq" ON "member_action_reminder" USING btree ("recipient_user_id","action_type","subject_id");