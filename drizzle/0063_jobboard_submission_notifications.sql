CREATE TABLE "jobboard_submission_notification" (
	"user_id" text NOT NULL,
	"submission_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "jobboard_submission_notification_user_id_submission_id_pk" PRIMARY KEY("user_id","submission_id")
);
--> statement-breakpoint
ALTER TABLE "jobboard_submission_notification" ADD CONSTRAINT "jobboard_submission_notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobboard_submission_notification" ADD CONSTRAINT "jobboard_submission_notification_submission_id_jobboard_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."jobboard_submission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobboard_notification_inbox_idx" ON "jobboard_submission_notification" USING btree ("user_id","created_at","submission_id");--> statement-breakpoint
CREATE INDEX "jobboard_notification_unread_idx" ON "jobboard_submission_notification" USING btree ("user_id") WHERE "jobboard_submission_notification"."read_at" IS NULL;