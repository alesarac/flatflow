-- ====================================================================
-- Flatflow — Migrazione 02: Tabella shopping_items (Lista della spesa)
-- ====================================================================
-- Obiettivo: memorizzare i prodotti della lista della spesa condivisa
-- tra i tre coinquilini, tracciando chi ha aggiunto ciascun prodotto,
-- lo stato d'acquisto (da comprare / comprato) e chi lo ha comprato.
-- ====================================================================

-- 1. Crea la tabella shopping_items
CREATE TABLE IF NOT EXISTS shopping_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_bought BOOLEAN NOT NULL DEFAULT FALSE,
  added_by INT NOT NULL REFERENCES roommates(id) ON DELETE CASCADE,
  added_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bought_by INT REFERENCES roommates(id) ON DELETE SET NULL,
  bought_by_name TEXT,
  bought_at TIMESTAMPTZ
);

-- 2. Indici per ottimizzare interrogazioni e ordinamento
CREATE INDEX IF NOT EXISTS idx_shopping_items_is_bought ON shopping_items(is_bought);
CREATE INDEX IF NOT EXISTS idx_shopping_items_created_at ON shopping_items(created_at DESC);

-- 3. Sicurezza Row Level Security (RLS)
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;

-- Revoca permessi pubblici/anonimi
REVOKE ALL ON shopping_items FROM anon, authenticated;

-- Rimuovi eventuali policy preesistenti
DROP POLICY IF EXISTS "Service role full access" ON shopping_items;

-- Concedi accesso esclusivo al ruolo di servizio backend
GRANT ALL ON shopping_items TO service_role;
CREATE POLICY "Service role full access" ON shopping_items TO service_role USING (true) WITH CHECK (true);
