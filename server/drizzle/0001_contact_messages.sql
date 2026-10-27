CREATE TABLE "contact_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"email" varchar(255),
	"subject" varchar(255),
	"message" text NOT NULL,
	"status" varchar(30) DEFAULT 'new' NOT NULL,
	"admin_note" text,
	"user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
