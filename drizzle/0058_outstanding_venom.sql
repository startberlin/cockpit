CREATE TABLE "referrals_campaign" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"batch_number" integer,
	"form_id" text NOT NULL,
	"application_url" text NOT NULL,
	"ref_field_key" text NOT NULL,
	"campaign_field_key" text NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referrals_campaign_window_check" CHECK ("referrals_campaign"."closes_at" > "referrals_campaign"."opens_at"),
	CONSTRAINT "referrals_campaign_keys_check" CHECK ("referrals_campaign"."ref_field_key" <> "referrals_campaign"."campaign_field_key")
);
--> statement-breakpoint
CREATE TABLE "referrals_link" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals_submission" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"link_id" text,
	"form_id" text NOT NULL,
	"submission_id" text NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referrals_submission_status_check" CHECK ("referrals_submission"."status" in ('matched', 'missing_code', 'unknown_code', 'wrong_campaign', 'outside_window', 'invalid_fields')),
	CONSTRAINT "referrals_submission_link_check" CHECK (("referrals_submission"."status" = 'matched') = ("referrals_submission"."link_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "referrals_campaign" ADD CONSTRAINT "referrals_campaign_batch_number_batch_number_fk" FOREIGN KEY ("batch_number") REFERENCES "public"."batch"("number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals_link" ADD CONSTRAINT "referrals_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals_submission" ADD CONSTRAINT "referrals_submission_campaign_id_referrals_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."referrals_campaign"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals_submission" ADD CONSTRAINT "referrals_submission_link_id_referrals_link_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."referrals_link"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_campaign_form_unique" ON "referrals_campaign" USING btree ("form_id");--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_link_user_unique" ON "referrals_link" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_link_code_unique" ON "referrals_link" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_submission_form_submission_unique" ON "referrals_submission" USING btree ("form_id","submission_id");--> statement-breakpoint
CREATE INDEX "referrals_submission_link_campaign_idx" ON "referrals_submission" USING btree ("link_id","campaign_id");--> statement-breakpoint
CREATE INDEX "referrals_submission_campaign_status_idx" ON "referrals_submission" USING btree ("campaign_id","status");