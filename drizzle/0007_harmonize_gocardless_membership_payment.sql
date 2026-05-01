ALTER TABLE "membership_payment" ADD COLUMN "gocardless_billing_request_id" text;--> statement-breakpoint
ALTER TABLE "membership_payment" ADD COLUMN "gocardless_billing_request_flow_id" text;--> statement-breakpoint
UPDATE "membership_payment"
SET
	"gocardless_billing_request_id" = COALESCE(
		"metadata"->>'billingRequestId',
		CASE
			WHEN "provider_session_id" LIKE 'BRQ%' THEN "provider_session_id"
			ELSE NULL
		END
	),
	"gocardless_billing_request_flow_id" = COALESCE(
		"metadata"->>'billingRequestFlowId',
		CASE
			WHEN "provider_session_id" LIKE 'BRF%' THEN "provider_session_id"
			ELSE NULL
		END
	)
WHERE
	"gocardless_billing_request_id" IS NULL
	OR "gocardless_billing_request_flow_id" IS NULL;--> statement-breakpoint
ALTER TABLE "membership_payment" ADD CONSTRAINT "membership_payment_gocardless_billing_request_id_unique" UNIQUE("gocardless_billing_request_id");--> statement-breakpoint
ALTER TABLE "membership_payment" ADD CONSTRAINT "membership_payment_gocardless_billing_request_flow_id_unique" UNIQUE("gocardless_billing_request_flow_id");--> statement-breakpoint
ALTER TABLE "membership_payment" DROP COLUMN "provider_mode";--> statement-breakpoint
ALTER TABLE "membership_payment" DROP COLUMN "provider_template_id";--> statement-breakpoint
ALTER TABLE "membership_payment" DROP COLUMN "provider_session_id";--> statement-breakpoint
ALTER TABLE "membership_payment" DROP COLUMN "hosted_url";--> statement-breakpoint
ALTER TABLE "membership_payment" DROP COLUMN "metadata";--> statement-breakpoint
DROP TABLE IF EXISTS "gocardless_event";--> statement-breakpoint
DROP TYPE IF EXISTS "gocardless_event_status";
