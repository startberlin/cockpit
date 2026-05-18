ALTER TABLE "group_criteria" ADD COLUMN "conditions" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "group_criteria" DROP COLUMN "department";--> statement-breakpoint
ALTER TABLE "group_criteria" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "group_criteria" DROP COLUMN "batch_number";