CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_name" varchar(100) NOT NULL,
	"item" varchar(100) NOT NULL,
	"rider_status" varchar(50) DEFAULT 'dispatched' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
