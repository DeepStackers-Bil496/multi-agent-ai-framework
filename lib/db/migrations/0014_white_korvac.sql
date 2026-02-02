ALTER TABLE "AgentConfiguration" ADD COLUMN "chatTemplate" varchar(32);--> statement-breakpoint
ALTER TABLE "AgentConfiguration" ADD COLUMN "customTemplate" jsonb;