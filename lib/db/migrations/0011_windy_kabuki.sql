CREATE TABLE IF NOT EXISTS "AgentConfiguration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"agentId" varchar(64) NOT NULL,
	"deploymentType" varchar(16) DEFAULT 'cloud' NOT NULL,
	"provider" varchar(32),
	"modelId" varchar(128),
	"apiKey" text,
	"baseUrl" text,
	"agentSecrets" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AgentConfiguration" ADD CONSTRAINT "AgentConfiguration_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_agent_config_idx" ON "AgentConfiguration" USING btree ("userId","agentId");