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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_username" varchar(255) NOT NULL,
	"player_fullname" varchar(255) NOT NULL,
	"note" text NOT NULL,
	"transaction_id" integer NOT NULL,
	"method" varchar(255) NOT NULL,
	"amount" double precision NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"concluded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawal_status" "withdrawal_status" DEFAULT 'pending' NOT NULL,
	"message" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_status_logs" ADD CONSTRAINT "user_status_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;