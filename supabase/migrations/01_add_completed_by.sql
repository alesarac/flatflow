-- ====================================================================
-- Flatflow — Migrazione 01: Aggiunta completed_by a cleaning_tasks
-- ====================================================================
-- Obiettivo: identificare in modo stabile il coinquilino che ha completato
-- una pulizia tramite ID (0, 1, 2) anziché tramite nome testuale.
-- Ciò impedisce problemi di autorizzazione all'annullamento in caso
-- di coinquilini con lo stesso nome o modifiche successive del nome.
-- ====================================================================

-- 1. Aggiungi la colonna completed_by alla tabella cleaning_tasks
ALTER TABLE cleaning_tasks
ADD COLUMN IF NOT EXISTS completed_by INT REFERENCES roommates(id) ON DELETE SET NULL;

-- 2. Indice per velocizzare ricerche e controlli di integrità
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_completed_by ON cleaning_tasks(completed_by);

-- 3. Backfill retroattivo opzionale per attività già completate:
-- Abbina completed_by_name al coinquilino corrispondente nella tabella roommates
UPDATE cleaning_tasks ct
SET completed_by = r.id
FROM roommates r
WHERE ct.completed_by IS NULL
  AND ct.is_completed = TRUE
  AND ct.completed_by_name = r.name;
