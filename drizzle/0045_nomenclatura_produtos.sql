CREATE TABLE "product_terms" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"meaning" text NOT NULL,
	"category" text DEFAULT 'Outros' NOT NULL,
	"note" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_terms_code_unique" UNIQUE("code")
);

--> statement-breakpoint
INSERT INTO "product_terms" ("code", "meaning", "category") VALUES
  ('NYL', 'Nylon', 'Material'),
  ('AC', 'Aço Carbono', 'Material'),
  ('RI', 'Rosca Inteira', 'Rosca'),
  ('RP', 'Rosca Parcial', 'Rosca'),
  ('CA', 'Cabeça Alta', 'Cabeça'),
  ('CB', 'Cabeça Baixa', 'Cabeça')
ON CONFLICT ("code") DO NOTHING;
