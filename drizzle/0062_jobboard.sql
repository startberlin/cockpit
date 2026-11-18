ALTER TYPE "public"."access_grant" ADD VALUE 'jobboard_editor';--> statement-breakpoint
CREATE TABLE "jobboard_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"event_type" text NOT NULL,
	"actor_id" text,
	"actor_name" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobboard_company" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"website" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"contacts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"terms" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobboard_job" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"content" jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"draft_version" integer DEFAULT 1 NOT NULL,
	"published_draft_version" integer,
	"published" jsonb,
	"published_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobboard_job_status_check" CHECK ("jobboard_job"."status" in ('draft', 'published', 'paused', 'closed', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "jobboard_metric_daily" (
	"day" date NOT NULL,
	"job_id" text DEFAULT '' NOT NULL,
	"type" text NOT NULL,
	"surface" text NOT NULL,
	"source" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "jobboard_metric_daily_day_job_id_type_surface_source_pk" PRIMARY KEY("day","job_id","type","surface","source"),
	CONSTRAINT "jobboard_metric_daily_count_check" CHECK ("jobboard_metric_daily"."count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "jobboard_metric_receipt" (
	"event_id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobboard_revision" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"review_notes" text NOT NULL,
	"actor_id" text,
	"actor_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobboard_service_window" (
	"scope" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobboard_submission" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"payload_hash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"job_id" text,
	"review_note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobboard_submission_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "jobboard_submission_status_check" CHECK ("jobboard_submission"."status" in ('pending_review', 'accepted', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "jobboard_audit" ADD CONSTRAINT "jobboard_audit_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobboard_job" ADD CONSTRAINT "jobboard_job_company_id_jobboard_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."jobboard_company"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobboard_job" ADD CONSTRAINT "jobboard_job_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobboard_revision" ADD CONSTRAINT "jobboard_revision_job_id_jobboard_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobboard_job"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobboard_revision" ADD CONSTRAINT "jobboard_revision_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobboard_submission" ADD CONSTRAINT "jobboard_submission_job_id_jobboard_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobboard_job"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobboard_audit_entity_idx" ON "jobboard_audit" USING btree ("entity_id","created_at");--> statement-breakpoint
CREATE INDEX "jobboard_company_name_idx" ON "jobboard_company" USING btree ("name");--> statement-breakpoint
CREATE INDEX "jobboard_job_company_idx" ON "jobboard_job" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "jobboard_job_publication_idx" ON "jobboard_job" USING btree ("status","expires_at","id");--> statement-breakpoint
CREATE INDEX "jobboard_metric_receipt_retention_idx" ON "jobboard_metric_receipt" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "jobboard_revision_job_idx" ON "jobboard_revision" USING btree ("job_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobboard_service_window_unique" ON "jobboard_service_window" USING btree ("scope","window_start");--> statement-breakpoint
CREATE INDEX "jobboard_submission_queue_idx" ON "jobboard_submission" USING btree ("status","created_at");