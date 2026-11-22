CREATE INDEX IF NOT EXISTS "visits_code_trgm" ON "visits" USING gin ("code" gin_trgm_ops);
