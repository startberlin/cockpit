ALTER TABLE "users_to_groups" ADD COLUMN "joined_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
UPDATE "users_to_groups" utg SET "joined_at" = u."created_at" FROM "user" u WHERE utg."user_id" = u."id";