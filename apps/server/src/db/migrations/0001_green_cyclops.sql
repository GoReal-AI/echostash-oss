ALTER TABLE "scorers" ALTER COLUMN "type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "dataset_cases" ADD COLUMN "messages" jsonb;--> statement-breakpoint
ALTER TABLE "scorers" ADD COLUMN "family" text NOT NULL;--> statement-breakpoint
ALTER TABLE "scorers" ADD COLUMN "op" text NOT NULL;--> statement-breakpoint
ALTER TABLE "scorers" ADD COLUMN "target" text DEFAULT 'response' NOT NULL;--> statement-breakpoint
ALTER TABLE "scorers" ADD COLUMN "weight" double precision DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "scorers" ADD COLUMN "threshold" double precision;--> statement-breakpoint
ALTER TABLE "scorers" ADD COLUMN "negate" boolean DEFAULT false NOT NULL;