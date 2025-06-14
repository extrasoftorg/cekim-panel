CREATE TABLE "user_status_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"activity_status" "activity_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"username" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"hashed_password" text NOT NULL,
	"role" "role" NOT NULL,
	"activity_status" "activity_status" DEFAULT 'offline' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "withdrawal_transfers" (
	"withdrawal_id" integer NOT NULL,
	"transferred_to" uuid,
	"transferred_by" uuid,
	"transferred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_username" varchar(255) NOT NULL,
	"player_fullname" varchar(255) NOT NULL,
	"note" text NOT NULL,
	"additional_info" jsonb,
	"reject_reason" "reject_reason",
	"transaction_id" integer NOT NULL,
	"method" varchar(255) NOT NULL,
	"amount" double precision NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"concluded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawal_status" "withdrawal_status" DEFAULT 'pending' NOT NULL,
	"message" text NOT NULL,
	"handling_by" uuid,
	"handler_username" text
);
--> statement-breakpoint
ALTER TABLE "user_status_logs" ADD CONSTRAINT "user_status_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_transfers" ADD CONSTRAINT "withdrawal_transfers_withdrawal_id_withdrawals_id_fk" FOREIGN KEY ("withdrawal_id") REFERENCES "public"."withdrawals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_transfers" ADD CONSTRAINT "withdrawal_transfers_transferred_to_users_id_fk" FOREIGN KEY ("transferred_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_transfers" ADD CONSTRAINT "withdrawal_transfers_transferred_by_users_id_fk" FOREIGN KEY ("transferred_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_handling_by_users_id_fk" FOREIGN KEY ("handling_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "withdrawal_id_index" ON "withdrawal_transfers" USING btree ("withdrawal_id");--> statement-breakpoint
CREATE INDEX "player_fullname_index" ON "withdrawals" USING btree ("player_fullname");