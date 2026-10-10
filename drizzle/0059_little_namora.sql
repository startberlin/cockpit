CREATE TYPE "public"."newsletter_asset_driver" AS ENUM('local', 'blob');--> statement-breakpoint
CREATE TYPE "public"."newsletter_issue_status" AS ENUM('draft', 'scheduled', 'sending', 'sent', 'canceled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."newsletter_send_mode" AS ENUM('sandbox', 'live');--> statement-breakpoint
CREATE TABLE "newsletter_asset" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"pathname" text NOT NULL,
	"driver" "newsletter_asset_driver" NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"alt" text DEFAULT '' NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_contact" (
	"id" text PRIMARY KEY NOT NULL,
	"resend_contact_id" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"unsubscribed" boolean DEFAULT false NOT NULL,
	"topics" jsonb,
	"segments" jsonb,
	"properties" jsonb,
	"resend_created_at" timestamp with time zone,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_issue" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"preview_text" text DEFAULT '' NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "newsletter_issue_status" DEFAULT 'draft' NOT NULL,
	"from_address" text,
	"reply_to" text,
	"segment_id" text,
	"topic_id" text,
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"resend_broadcast_id" text,
	"send_mode" "newsletter_send_mode",
	"last_error" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_issue_editor" (
	"issue_id" text NOT NULL,
	"editor_session_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"changed_at" timestamp with time zone,
	CONSTRAINT "newsletter_issue_editor_issue_id_editor_session_id_pk" PRIMARY KEY("issue_id","editor_session_id")
);
--> statement-breakpoint
ALTER TABLE "newsletter_asset" ADD CONSTRAINT "newsletter_asset_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_issue" ADD CONSTRAINT "newsletter_issue_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_issue_editor" ADD CONSTRAINT "newsletter_issue_editor_issue_id_newsletter_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."newsletter_issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_issue_editor" ADD CONSTRAINT "newsletter_issue_editor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "newsletter_asset_created_at_idx" ON "newsletter_asset" USING btree ("created_at" desc);--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_contact_resend_id_idx" ON "newsletter_contact" USING btree ("resend_contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_contact_email_idx" ON "newsletter_contact" USING btree ("email");--> statement-breakpoint
CREATE INDEX "newsletter_contact_unsubscribed_idx" ON "newsletter_contact" USING btree ("unsubscribed");--> statement-breakpoint
CREATE INDEX "newsletter_issue_status_idx" ON "newsletter_issue" USING btree ("status","created_at" desc);--> statement-breakpoint
CREATE INDEX "newsletter_issue_created_at_idx" ON "newsletter_issue" USING btree ("created_at" desc);--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_issue_broadcast_idx" ON "newsletter_issue" USING btree ("resend_broadcast_id") WHERE "newsletter_issue"."resend_broadcast_id" is not null;--> statement-breakpoint
CREATE INDEX "newsletter_issue_editor_expiry_idx" ON "newsletter_issue_editor" USING btree ("last_seen_at");