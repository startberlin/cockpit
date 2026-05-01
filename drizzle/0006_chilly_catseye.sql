CREATE TYPE "public"."gocardless_event_status" AS ENUM('processed', 'ignored', 'unmatched', 'failed');--> statement-breakpoint
CREATE TYPE "public"."membership_payment_status" AS ENUM('pending', 'checkout_started', 'active', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "group_criteria" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"name" text NOT NULL,
	"department" "department",
	"roles" "role"[],
	"status" "user_status",
	"batch_number" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gocardless_event" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_type" text NOT NULL,
	"action" text NOT NULL,
	"status" "gocardless_event_status" DEFAULT 'ignored' NOT NULL,
	"user_id" text,
	"membership_payment_id" text,
	"payload" jsonb NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_payment" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" "membership_payment_status" DEFAULT 'pending' NOT NULL,
	"provider" text DEFAULT 'gocardless' NOT NULL,
	"provider_mode" text,
	"provider_template_id" text,
	"provider_session_id" text,
	"hosted_url" text,
	"gocardless_customer_id" text,
	"gocardless_subscription_id" text,
	"gocardless_mandate_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"activated_at" timestamp,
	CONSTRAINT "membership_payment_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "membership_payment_gocardless_customer_id_unique" UNIQUE("gocardless_customer_id"),
	CONSTRAINT "membership_payment_gocardless_subscription_id_unique" UNIQUE("gocardless_subscription_id"),
	CONSTRAINT "membership_payment_gocardless_mandate_id_unique" UNIQUE("gocardless_mandate_id")
);
--> statement-breakpoint
ALTER TABLE "group_criteria" ADD CONSTRAINT "group_criteria_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_criteria" ADD CONSTRAINT "group_criteria_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gocardless_event" ADD CONSTRAINT "gocardless_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gocardless_event" ADD CONSTRAINT "gocardless_event_membership_payment_id_membership_payment_id_fk" FOREIGN KEY ("membership_payment_id") REFERENCES "public"."membership_payment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_payment" ADD CONSTRAINT "membership_payment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;