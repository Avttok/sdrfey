-- Busca por trecho do nome (ILIKE '%...%') usa índice trigram quando a extensão está disponível.
-- Se o provedor não permitir a extensão, a migração segue sem erro e a busca continua funcionando (só sem o índice).
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm indisponível: busca segue sem índice trigram';
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE INDEX IF NOT EXISTS leads_company_trgm_idx ON leads USING gin (company gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS leads_trade_name_trgm_idx ON leads USING gin (trade_name gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS leads_cnpj_trgm_idx ON leads USING gin (cnpj gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS lead_people_name_trgm_idx ON lead_people USING gin (name gin_trgm_ops);
  END IF;
END $$;
--> statement-breakpoint
ANALYZE;
