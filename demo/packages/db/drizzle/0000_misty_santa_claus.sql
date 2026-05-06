CREATE TYPE "public"."generation_status" AS ENUM('pending', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."generation_type" AS ENUM('copy_variant', 'translate', 'image');--> statement-breakpoint
CREATE TYPE "public"."brand_profile_status" AS ENUM('processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."usage_feature" AS ENUM('copy_variant', 'translate', 'image', 'extract');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "brand_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"profile" jsonb,
	"source_pdf_s3_key" text,
	"source_pdf_filename" text,
	"source_pdf_size_bytes" integer,
	"status" "brand_profile_status" NOT NULL,
	"ingest_error" text,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "brand" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "generation_type" NOT NULL,
	"status" "generation_status" NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"error" text,
	"figma_file_key" text,
	"figma_node_id" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"brand_id" uuid,
	"user_id" uuid,
	"generation_id" uuid,
	"feature" "usage_feature" NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" numeric(10, 6) NOT NULL,
	"latency_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'designer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brand_profile" ADD CONSTRAINT "brand_profile_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brand_profile" ADD CONSTRAINT "brand_profile_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brand_profile" ADD CONSTRAINT "brand_profile_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brand" ADD CONSTRAINT "brand_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generation" ADD CONSTRAINT "generation_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generation" ADD CONSTRAINT "generation_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generation" ADD CONSTRAINT "generation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage_event" ADD CONSTRAINT "usage_event_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage_event" ADD CONSTRAINT "usage_event_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage_event" ADD CONSTRAINT "usage_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage_event" ADD CONSTRAINT "usage_event_generation_id_generation_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."generation"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user" ADD CONSTRAINT "user_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bp_org_idx" ON "brand_profile" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bp_brand_version_idx" ON "brand_profile" USING btree ("org_id","brand_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bp_brand_current_unique" ON "brand_profile" USING btree ("brand_id") WHERE "brand_profile"."is_current" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bp_status_idx" ON "brand_profile" USING btree ("org_id","status") WHERE "brand_profile"."status" IN ('processing','failed');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brand_org_idx" ON "brand" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gen_org_idx" ON "generation" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gen_user_time_idx" ON "generation" USING btree ("org_id","user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gen_active_idx" ON "generation" USING btree ("org_id","status") WHERE "generation"."status" IN ('pending','running');--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gen_node_lock_idx" ON "generation" USING btree ("org_id","figma_file_key","figma_node_id") WHERE "generation"."type" = 'image' AND "generation"."status" IN ('pending','running');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ue_org_idx" ON "usage_event" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ue_time_idx" ON "usage_event" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ue_user_time_idx" ON "usage_event" USING btree ("org_id","user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ue_brand_time_idx" ON "usage_event" USING btree ("org_id","brand_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_org_idx" ON "user" USING btree ("org_id");