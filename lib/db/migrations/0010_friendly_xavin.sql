CREATE TABLE IF NOT EXISTS "UserProfile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"fullName" varchar(128),
	"nickname" varchar(64),
	"workType" varchar(32),
	"personalPreferences" text,
	"notifyResponseCompletions" boolean DEFAULT true NOT NULL,
	"notifyEmails" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "UserProfile_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_profile_userId_idx" ON "UserProfile" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_userId_idx" ON "Chat" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_chatId_idx" ON "Message_v2" USING btree ("chatId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_createdAt_idx" ON "Message_v2" USING btree ("createdAt");