ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_google_workspace_id_unique";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "google_workspace_id";
