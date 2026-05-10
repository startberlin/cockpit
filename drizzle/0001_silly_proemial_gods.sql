ALTER TABLE "user" DROP CONSTRAINT "user_batch_number_batch_number_fk";
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "batch_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_batch_number_batch_number_fk" FOREIGN KEY ("batch_number") REFERENCES "public"."batch"("number") ON DELETE set null ON UPDATE no action;