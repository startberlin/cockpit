CREATE UNIQUE INDEX "one_president_unique" ON "user_organization_position" USING btree ("position") WHERE "user_organization_position"."position" = 'president' AND "user_organization_position"."scope" = 'global';--> statement-breakpoint
CREATE UNIQUE INDEX "one_vice_president_unique" ON "user_organization_position" USING btree ("position") WHERE "user_organization_position"."position" = 'vice_president' AND "user_organization_position"."scope" = 'global';--> statement-breakpoint
CREATE UNIQUE INDEX "one_head_of_finance_unique" ON "user_organization_position" USING btree ("position") WHERE "user_organization_position"."position" = 'head_of_finance' AND "user_organization_position"."scope" = 'global';--> statement-breakpoint
CREATE UNIQUE INDEX "one_department_head_per_department_unique" ON "user_organization_position" USING btree ("department") WHERE "user_organization_position"."position" = 'department_head' AND "user_organization_position"."scope" = 'department';--> statement-breakpoint
ALTER TABLE "user_access_grant" ADD CONSTRAINT "user_access_grant_valid_scope_check" CHECK ((
        "user_access_grant"."grant" = 'admin' AND "user_access_grant"."scope" = 'global' AND "user_access_grant"."department" IS NULL
      ));--> statement-breakpoint
ALTER TABLE "user_organization_position" ADD CONSTRAINT "user_organization_position_valid_scope_check" CHECK ((
        ("user_organization_position"."position" IN ('president', 'vice_president', 'head_of_finance') AND "user_organization_position"."scope" = 'global' AND "user_organization_position"."department" IS NULL)
        OR ("user_organization_position"."position" = 'department_head' AND "user_organization_position"."scope" = 'department' AND "user_organization_position"."department" IS NOT NULL)
      )); 
