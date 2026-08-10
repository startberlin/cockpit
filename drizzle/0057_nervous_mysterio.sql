DROP INDEX "example_note_user_id_idx";--> statement-breakpoint
CREATE INDEX "example_note_user_id_idx" ON "example_note" USING btree ("user_id","created_at" desc);