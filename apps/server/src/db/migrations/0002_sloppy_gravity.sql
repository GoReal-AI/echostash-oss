ALTER TABLE "eval_runs" ADD COLUMN "variant_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN "scorer_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN "sample_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN "error" text;