CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "prompt_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"prompt_id" text NOT NULL,
	"content_hash" text NOT NULL,
	"config_hash" text NOT NULL,
	"content" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider" text,
	"model" text,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resolution" text NOT NULL,
	"source_id" text NOT NULL,
	"git_sha" text,
	"git_ref" text,
	"file_path" text,
	"symbol" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seen_count" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_tags" (
	"prompt_id" text NOT NULL,
	"tag_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompts" (
	"id" text PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"name" text NOT NULL,
	"project_id" text,
	"type" text DEFAULT 'prompt' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prompts_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
CREATE TABLE "scan_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"git_sha" text,
	"git_ref" text,
	"status" text DEFAULT 'done' NOT NULL,
	"prompts_found" integer DEFAULT 0 NOT NULL,
	"changes_detected" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "dataset_cases" (
	"id" text PRIMARY KEY NOT NULL,
	"dataset_id" text NOT NULL,
	"name" text NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expected" jsonb,
	"source" text DEFAULT 'manual' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "datasets" (
	"id" text PRIMARY KEY NOT NULL,
	"prompt_id" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_run_cells" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"case_id" text NOT NULL,
	"sample_no" integer DEFAULT 0 NOT NULL,
	"output_text" text,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"total_tokens" integer,
	"cost_usd" numeric,
	"latency_ms" integer,
	"cached" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"prompt_id" text NOT NULL,
	"dataset_id" text NOT NULL,
	"trigger" text NOT NULL,
	"executor" text NOT NULL,
	"git_sha" text,
	"config_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"summary_total" integer DEFAULT 0 NOT NULL,
	"summary_passed" integer DEFAULT 0 NOT NULL,
	"summary_failed" integer DEFAULT 0 NOT NULL,
	"summary_errored" integer DEFAULT 0 NOT NULL,
	"score" numeric,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"cell_id" text NOT NULL,
	"scorer_id" text NOT NULL,
	"value" numeric NOT NULL,
	"passed" boolean NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scorers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" text PRIMARY KEY NOT NULL,
	"prompt_id" text NOT NULL,
	"name" text NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" text NOT NULL,
	"base_snapshot_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"hash" text NOT NULL,
	"prefix" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_prefix_unique" UNIQUE("prefix")
);
--> statement-breakpoint
CREATE TABLE "workspace_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value_encrypted" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "prompt_snapshots" ADD CONSTRAINT "prompt_snapshots_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_snapshots" ADD CONSTRAINT "prompt_snapshots_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_tags" ADD CONSTRAINT "prompt_tags_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_tags" ADD CONSTRAINT "prompt_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_runs" ADD CONSTRAINT "scan_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataset_cases" ADD CONSTRAINT "dataset_cases_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_run_cells" ADD CONSTRAINT "eval_run_cells_run_id_eval_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."eval_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_scores" ADD CONSTRAINT "eval_scores_cell_id_eval_run_cells_id_fk" FOREIGN KEY ("cell_id") REFERENCES "public"."eval_run_cells"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "snapshots_prompt_content_idx" ON "prompt_snapshots" USING btree ("prompt_id","content_hash","config_hash");--> statement-breakpoint
CREATE INDEX "snapshots_prompt_idx" ON "prompt_snapshots" USING btree ("prompt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_tags_pk" ON "prompt_tags" USING btree ("prompt_id","tag_id");--> statement-breakpoint
CREATE INDEX "prompts_project_idx" ON "prompts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "scan_runs_source_idx" ON "scan_runs" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "dataset_cases_dataset_idx" ON "dataset_cases" USING btree ("dataset_id");--> statement-breakpoint
CREATE INDEX "eval_cells_run_idx" ON "eval_run_cells" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "eval_runs_prompt_idx" ON "eval_runs" USING btree ("prompt_id");--> statement-breakpoint
CREATE INDEX "eval_runs_config_idx" ON "eval_runs" USING btree ("config_hash");--> statement-breakpoint
CREATE INDEX "eval_scores_cell_idx" ON "eval_scores" USING btree ("cell_id");--> statement-breakpoint
CREATE INDEX "variants_prompt_idx" ON "variants" USING btree ("prompt_id");