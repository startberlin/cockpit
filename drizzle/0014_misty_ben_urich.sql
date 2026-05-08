CREATE TYPE "public"."board_vote_value" AS ENUM('yes', 'no', 'abstain', 'procedure_objection');--> statement-breakpoint
CREATE TYPE "public"."officer_function" AS ENUM('president', 'vice_president', 'head_of_finance');--> statement-breakpoint
CREATE TYPE "public"."legal_membership_status" AS ENUM('admission_pending', 'application_pending', 'processing', 'active', 'manual_followup', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "admission_participant" (
	"id" text PRIMARY KEY NOT NULL,
	"legal_membership_id" text NOT NULL,
	"user_id" text NOT NULL,
	"officer_function" "officer_function" NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_resolution" (
	"id" text PRIMARY KEY NOT NULL,
	"legal_membership_id" text NOT NULL,
	"resolution_text" text NOT NULL,
	"resolution_text_version" text NOT NULL,
	"resolution_text_hash" text NOT NULL,
	"billing_applies" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "board_resolution_legal_membership_id_unique" UNIQUE("legal_membership_id")
);
--> statement-breakpoint
CREATE TABLE "board_vote" (
	"id" text PRIMARY KEY NOT NULL,
	"legal_membership_id" text NOT NULL,
	"voter_user_id" text NOT NULL,
	"value" "board_vote_value" NOT NULL,
	"displayed_resolution_hash" text NOT NULL,
	"cast_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "board_vote_legal_membership_id_voter_user_id_unique" UNIQUE("legal_membership_id","voter_user_id")
);
--> statement-breakpoint
CREATE TABLE "legal_document" (
	"id" text PRIMARY KEY NOT NULL,
	"legal_membership_id" text NOT NULL,
	"document_type" text NOT NULL,
	"sha256" text NOT NULL,
	"drive_file_id" text NOT NULL,
	"drive_url" text NOT NULL,
	"renderer" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_membership" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" "legal_membership_status" NOT NULL,
	"inngest_run_id" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"activated_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_application" (
	"id" text PRIMARY KEY NOT NULL,
	"legal_membership_id" text NOT NULL,
	"subject_user_id" text NOT NULL,
	"street" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"zip" text NOT NULL,
	"country" text NOT NULL,
	"declarations" jsonb NOT NULL,
	"fee_text_version" text NOT NULL,
	"application_version" text NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "membership_application_legal_membership_id_unique" UNIQUE("legal_membership_id")
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"assignee_user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'open' NOT NULL,
	"due_at" timestamp,
	"completed_at" timestamp,
	"completed_by_user_id" text,
	"legal_membership_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admission_participant" ADD CONSTRAINT "admission_participant_legal_membership_id_legal_membership_id_fk" FOREIGN KEY ("legal_membership_id") REFERENCES "public"."legal_membership"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_participant" ADD CONSTRAINT "admission_participant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_resolution" ADD CONSTRAINT "board_resolution_legal_membership_id_legal_membership_id_fk" FOREIGN KEY ("legal_membership_id") REFERENCES "public"."legal_membership"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_vote" ADD CONSTRAINT "board_vote_legal_membership_id_legal_membership_id_fk" FOREIGN KEY ("legal_membership_id") REFERENCES "public"."legal_membership"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_vote" ADD CONSTRAINT "board_vote_voter_user_id_user_id_fk" FOREIGN KEY ("voter_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document" ADD CONSTRAINT "legal_document_legal_membership_id_legal_membership_id_fk" FOREIGN KEY ("legal_membership_id") REFERENCES "public"."legal_membership"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_membership" ADD CONSTRAINT "legal_membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_application" ADD CONSTRAINT "membership_application_legal_membership_id_legal_membership_id_fk" FOREIGN KEY ("legal_membership_id") REFERENCES "public"."legal_membership"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_application" ADD CONSTRAINT "membership_application_subject_user_id_user_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_user_id_user_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_completed_by_user_id_user_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_legal_membership_id_legal_membership_id_fk" FOREIGN KEY ("legal_membership_id") REFERENCES "public"."legal_membership"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "legal_membership_active_tenure_idx" ON "legal_membership" ("user_id") WHERE status IN ('admission_pending', 'application_pending', 'processing', 'active');