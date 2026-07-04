CREATE TABLE "payment_proposal_digest_log" (
	"id" text PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"proposal_count" integer NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "payment_proposal_digest_log_sent_at_idx" ON "payment_proposal_digest_log" USING btree ("sent_at");