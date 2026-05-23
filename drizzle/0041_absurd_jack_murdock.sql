CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"event_type" text NOT NULL,
	"actor_id" text,
	"actor_name" text,
	"subject_id" text,
	"subject_name" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_subject_id_user_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_category_idx" ON "audit_log" USING btree ("category");--> statement-breakpoint
CREATE INDEX "audit_log_actor_id_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_log_subject_id_idx" ON "audit_log" USING btree ("subject_id");