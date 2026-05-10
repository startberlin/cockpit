CREATE TYPE "public"."department" AS ENUM('partnerships', 'operations', 'community', 'growth', 'events');--> statement-breakpoint
CREATE TYPE "public"."legal_membership_state" AS ENUM('not_member', 'active_member', 'former_member');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('onboarding', 'member', 'supporting_alumni', 'alumni');--> statement-breakpoint
CREATE TYPE "public"."access_grant" AS ENUM('admin');--> statement-breakpoint
CREATE TYPE "public"."authority_scope" AS ENUM('global', 'department');--> statement-breakpoint
CREATE TYPE "public"."organization_position" AS ENUM('president', 'vice_president', 'head_of_finance', 'department_head');--> statement-breakpoint
CREATE TYPE "public"."board_vote_value" AS ENUM('yes', 'no', 'abstain', 'procedure_objection');--> statement-breakpoint
CREATE TYPE "public"."officer_function" AS ENUM('president', 'vice_president', 'head_of_finance');--> statement-breakpoint
CREATE TYPE "public"."group_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."legal_membership_status" AS ENUM('admission_pending', 'application_pending', 'processing', 'active', 'manual_followup', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."membership_payment_status" AS ENUM('pending', 'checkout_started', 'active', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" text,
	"target_user_id" text,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"street" text,
	"state" text,
	"city" text,
	"zip" text,
	"country" text,
	"personal_email" text NOT NULL,
	"batch_number" integer NOT NULL,
	"phone" text,
	"status" "user_status" DEFAULT 'onboarding' NOT NULL,
	"department" "department",
	"legal_membership_state" "legal_membership_state" DEFAULT 'not_member' NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_access_grant" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"grant" "access_grant" NOT NULL,
	"scope" "authority_scope" NOT NULL,
	"department" "department",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_grant_scope_department_unique" UNIQUE NULLS NOT DISTINCT("user_id","grant","scope","department"),
	CONSTRAINT "user_access_grant_valid_scope_check" CHECK ((
        "user_access_grant"."grant" = 'admin' AND "user_access_grant"."scope" = 'global' AND "user_access_grant"."department" IS NULL
      ))
);
--> statement-breakpoint
CREATE TABLE "user_organization_position" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"position" "organization_position" NOT NULL,
	"scope" "authority_scope" NOT NULL,
	"department" "department",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_position_scope_department_unique" UNIQUE NULLS NOT DISTINCT("user_id","position","scope","department"),
	CONSTRAINT "user_organization_position_valid_scope_check" CHECK ((
        ("user_organization_position"."position" IN ('president', 'vice_president', 'head_of_finance') AND "user_organization_position"."scope" = 'global' AND "user_organization_position"."department" IS NULL)
        OR ("user_organization_position"."position" = 'department_head' AND "user_organization_position"."scope" = 'department' AND "user_organization_position"."department" IS NOT NULL)
      ))
);
--> statement-breakpoint
CREATE TABLE "batch" (
	"number" integer PRIMARY KEY NOT NULL,
	"start_date" date NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "group" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "group_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "group_criteria" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"name" text NOT NULL,
	"department" "department",
	"status" "user_status",
	"batch_number" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users_to_groups" (
	"user_id" text NOT NULL,
	"group_id" text NOT NULL,
	"role" "group_role" DEFAULT 'member' NOT NULL,
	CONSTRAINT "users_to_groups_user_id_group_id_pk" PRIMARY KEY("user_id","group_id")
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "legal_document_legal_membership_id_document_type_unique" UNIQUE("legal_membership_id","document_type")
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
CREATE TABLE "membership_payment" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" "membership_payment_status" DEFAULT 'pending' NOT NULL,
	"provider" text DEFAULT 'gocardless' NOT NULL,
	"gocardless_customer_id" text,
	"gocardless_billing_request_id" text,
	"gocardless_billing_request_flow_id" text,
	"gocardless_subscription_id" text,
	"gocardless_mandate_id" text,
	"paid_through_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"activated_at" timestamp,
	CONSTRAINT "membership_payment_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "membership_payment_gocardless_customer_id_unique" UNIQUE("gocardless_customer_id"),
	CONSTRAINT "membership_payment_gocardless_billing_request_id_unique" UNIQUE("gocardless_billing_request_id"),
	CONSTRAINT "membership_payment_gocardless_billing_request_flow_id_unique" UNIQUE("gocardless_billing_request_flow_id"),
	CONSTRAINT "membership_payment_gocardless_subscription_id_unique" UNIQUE("gocardless_subscription_id"),
	CONSTRAINT "membership_payment_gocardless_mandate_id_unique" UNIQUE("gocardless_mandate_id")
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
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_batch_number_batch_number_fk" FOREIGN KEY ("batch_number") REFERENCES "public"."batch"("number") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_access_grant" ADD CONSTRAINT "user_access_grant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organization_position" ADD CONSTRAINT "user_organization_position_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_participant" ADD CONSTRAINT "admission_participant_legal_membership_id_legal_membership_id_fk" FOREIGN KEY ("legal_membership_id") REFERENCES "public"."legal_membership"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_participant" ADD CONSTRAINT "admission_participant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_resolution" ADD CONSTRAINT "board_resolution_legal_membership_id_legal_membership_id_fk" FOREIGN KEY ("legal_membership_id") REFERENCES "public"."legal_membership"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_vote" ADD CONSTRAINT "board_vote_legal_membership_id_legal_membership_id_fk" FOREIGN KEY ("legal_membership_id") REFERENCES "public"."legal_membership"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_vote" ADD CONSTRAINT "board_vote_voter_user_id_user_id_fk" FOREIGN KEY ("voter_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_criteria" ADD CONSTRAINT "group_criteria_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_criteria" ADD CONSTRAINT "group_criteria_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_to_groups" ADD CONSTRAINT "users_to_groups_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_to_groups" ADD CONSTRAINT "users_to_groups_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document" ADD CONSTRAINT "legal_document_legal_membership_id_legal_membership_id_fk" FOREIGN KEY ("legal_membership_id") REFERENCES "public"."legal_membership"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_membership" ADD CONSTRAINT "legal_membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_payment" ADD CONSTRAINT "membership_payment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_application" ADD CONSTRAINT "membership_application_legal_membership_id_legal_membership_id_fk" FOREIGN KEY ("legal_membership_id") REFERENCES "public"."legal_membership"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_application" ADD CONSTRAINT "membership_application_subject_user_id_user_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_user_id_user_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_completed_by_user_id_user_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_legal_membership_id_legal_membership_id_fk" FOREIGN KEY ("legal_membership_id") REFERENCES "public"."legal_membership"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_president_unique" ON "user_organization_position" USING btree ("position") WHERE "user_organization_position"."position" = 'president' AND "user_organization_position"."scope" = 'global';--> statement-breakpoint
CREATE UNIQUE INDEX "one_vice_president_unique" ON "user_organization_position" USING btree ("position") WHERE "user_organization_position"."position" = 'vice_president' AND "user_organization_position"."scope" = 'global';--> statement-breakpoint
CREATE UNIQUE INDEX "one_head_of_finance_unique" ON "user_organization_position" USING btree ("position") WHERE "user_organization_position"."position" = 'head_of_finance' AND "user_organization_position"."scope" = 'global';--> statement-breakpoint
CREATE UNIQUE INDEX "one_department_head_per_department_unique" ON "user_organization_position" USING btree ("department") WHERE "user_organization_position"."position" = 'department_head' AND "user_organization_position"."scope" = 'department';--> statement-breakpoint
CREATE INDEX "admission_participant_legal_membership_id_idx" ON "admission_participant" USING btree ("legal_membership_id");--> statement-breakpoint
CREATE INDEX "legal_document_legal_membership_id_idx" ON "legal_document" USING btree ("legal_membership_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_membership_active_tenure_idx" ON "legal_membership" USING btree ("user_id") WHERE "legal_membership"."status" IN ('admission_pending', 'application_pending', 'processing', 'active');