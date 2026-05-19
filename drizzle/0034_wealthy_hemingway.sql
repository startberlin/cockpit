ALTER TABLE "user_access_grant" DROP CONSTRAINT "user_access_grant_valid_scope_check";--> statement-breakpoint
ALTER TABLE "user_access_grant" DROP CONSTRAINT "user_access_grant_user_id_grant_scope_department_pk";--> statement-breakpoint
ALTER TABLE "user_access_grant" ADD CONSTRAINT "user_access_grant_user_id_grant_scope_pk" PRIMARY KEY("user_id","grant","scope");--> statement-breakpoint
ALTER TABLE "user_access_grant" DROP COLUMN "department";--> statement-breakpoint
ALTER TABLE "user_access_grant" ADD CONSTRAINT "user_access_grant_valid_scope_check" CHECK ("user_access_grant"."scope" = 'global');