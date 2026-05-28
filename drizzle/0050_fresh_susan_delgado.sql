CREATE TABLE "system_settings" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
