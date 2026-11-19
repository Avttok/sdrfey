-- Leads que entraram só com o CNPJ no lugar do nome: usa o nome já consultado na Receita (razão social ou fantasia).
UPDATE "leads" SET "company" = coalesce(nullif(btrim("brasilapi_data"->>'razao_social'), ''), nullif(btrim("receitaws_data"->>'nome'), ''), nullif(btrim("trade_name"), ''), "company"), "updated_at" = now()
WHERE "company" ~* '^CNPJ\s*[0-9]*$' AND "enriched_at" IS NOT NULL;
