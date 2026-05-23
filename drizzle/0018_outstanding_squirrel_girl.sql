CREATE TYPE "public"."email_suppression_reason" AS ENUM('bounce', 'complaint');--> statement-breakpoint
CREATE TABLE "email_suppression" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"reason" "email_suppression_reason" NOT NULL,
	"detail" text,
	"suppressed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_suppression_email_unique" UNIQUE("email")
);
