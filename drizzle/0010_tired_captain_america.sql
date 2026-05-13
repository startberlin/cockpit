CREATE TYPE "public"."membership_payment_cycle_status" AS ENUM('proposed', 'declined', 'pending', 'submitted', 'confirmed', 'paid_out', 'failed', 'cancelled', 'charged_back');--> statement-breakpoint
ALTER TYPE "public"."access_grant" ADD VALUE 'finance_admin';--> statement-breakpoint
CREATE TABLE "membership_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" "membership_payment_cycle_status" DEFAULT 'proposed' NOT NULL,
	"activation_date" date NOT NULL,
	"amount" integer DEFAULT 4000 NOT NULL,
	"gocardless_payment_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "membership_payments_gocardless_payment_id_unique" UNIQUE("gocardless_payment_id")
);
--> statement-breakpoint
ALTER TABLE "membership_payment" DROP CONSTRAINT "membership_payment_gocardless_subscription_id_unique";--> statement-breakpoint
ALTER TABLE "user_access_grant" DROP CONSTRAINT "user_access_grant_valid_scope_check";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "gocardless_mandate_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "gocardless_customer_id" text;--> statement-breakpoint
ALTER TABLE "membership_payments" ADD CONSTRAINT "membership_payments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "membership_payments_user_in_flight_unique" ON "membership_payments" USING btree ("user_id") WHERE "membership_payments"."status" IN ('proposed', 'pending', 'submitted');--> statement-breakpoint
CREATE INDEX "membership_payments_user_id_idx" ON "membership_payments" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "membership_payment" DROP COLUMN "gocardless_subscription_id";--> statement-breakpoint
ALTER TABLE "membership_payment" DROP COLUMN "paid_through_at";--> statement-breakpoint
ALTER TABLE "user_access_grant" ADD CONSTRAINT "user_access_grant_valid_scope_check" CHECK ((
        "user_access_grant"."scope" = 'global' AND "user_access_grant"."department" IS NULL
      ));