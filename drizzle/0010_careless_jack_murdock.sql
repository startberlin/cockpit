CREATE TYPE "public"."access_grant" AS ENUM('admin');--> statement-breakpoint
CREATE TYPE "public"."authority_scope" AS ENUM('global', 'department');--> statement-breakpoint
CREATE TYPE "public"."organization_position" AS ENUM('president', 'vice_president', 'head_of_finance', 'department_head');--> statement-breakpoint
CREATE TABLE "user_access_grant" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"grant" "access_grant" NOT NULL,
	"scope" "authority_scope" NOT NULL,
	"department" "department",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_grant_scope_department_unique" UNIQUE NULLS NOT DISTINCT("user_id","grant","scope","department")
);
--> statement-breakpoint
CREATE TABLE "user_organization_position" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"position" "organization_position" NOT NULL,
	"scope" "authority_scope" NOT NULL,
	"department" "department",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_position_scope_department_unique" UNIQUE NULLS NOT DISTINCT("user_id","position","scope","department")
);
--> statement-breakpoint
ALTER TABLE "user_access_grant" ADD CONSTRAINT "user_access_grant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organization_position" ADD CONSTRAINT "user_organization_position_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "user_access_grant" ("id", "user_id", "grant", "scope", "department")
SELECT
	'aug_' || substr(md5("id" || ':admin'), 1, 16),
	"id",
	'admin'::"access_grant",
	'global'::"authority_scope",
	NULL
FROM "user"
WHERE 'admin' = ANY("roles")
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "user_organization_position" ("id", "user_id", "position", "scope", "department")
SELECT
	'aup_' || substr(md5("id" || ':department_head'), 1, 16),
	"id",
	'department_head'::"organization_position",
	'department'::"authority_scope",
	"department"
FROM "user"
WHERE 'department_lead' = ANY("roles")
	AND "department" IS NOT NULL
ON CONFLICT DO NOTHING;
