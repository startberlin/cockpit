ALTER TABLE "user" ALTER COLUMN "first_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "last_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "department" ADD CONSTRAINT "department_lead_member_id_user_id_fk" FOREIGN KEY ("lead_member_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;