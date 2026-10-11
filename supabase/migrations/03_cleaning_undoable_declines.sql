-- ====================================================================
-- FlatLoop — Migrazione 03: Aggiunta undoable_declines a cleaning_tasks
-- ====================================================================
-- Obiettivo: tracciare esplicitamente lo stack delle rinunce annullabili
-- per un'attività di pulizia. Permette l'annullamento della rinuncia solo
-- da parte dell'ultimo coinquilino che ha rinunciato e impedisce
-- l'annullamento indebito di rinunce storiche dopo una presa in carico ("claim").
-- ====================================================================

-- 1. Aggiungi la colonna undoable_declines alla tabella cleaning_tasks
ALTER TABLE cleaning_tasks
ADD COLUMN IF NOT EXISTS undoable_declines INT[] NOT NULL DEFAULT '{}';
