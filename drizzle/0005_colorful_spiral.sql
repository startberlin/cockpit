ALTER TABLE "board_vote" ALTER COLUMN "value" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."board_vote_value";--> statement-breakpoint
CREATE TYPE "public"."board_vote_value" AS ENUM('yes', 'no');--> statement-breakpoint
ALTER TABLE "board_vote" ALTER COLUMN "value" SET DATA TYPE "public"."board_vote_value" USING "value"::"public"."board_vote_value";