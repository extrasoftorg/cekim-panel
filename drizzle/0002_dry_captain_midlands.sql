ALTER TABLE "withdrawals" ADD COLUMN "assigned_to" uuid;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN "assigned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;