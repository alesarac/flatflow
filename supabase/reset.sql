-- ====================================================================
-- Flatflow — Reset Dati di Prova (PostgreSQL / Supabase)
-- ====================================================================
-- Questo script azzera tutti i dati operativi di prova senza toccare la
-- struttura del database, le tabelle, gli indici, le funzioni RPC o le
-- policy di sicurezza (RLS).
--
-- DATI ELIMINATI:
-- - Tutte le pulizie registrate (completate e incomplete)
-- - Tutte le assenze settimanali registrate
-- - Tutte le segnalazioni e lo storico della spazzatura
-- - Tutti i tentativi di login (reset del rate limiting)
--
-- DATI E STRUTTURE CONSERVATI:
-- - I tre coinquilini e i rispettivi nomi (tabella roommates)
-- - Tutte le tabelle, vincoli di unicità e indici
-- - La funzione atomica rpc_complete_trash
-- - Tutte le configurazioni RLS e i permessi
-- - Ripristino della coda spazzatura all'ordine iniziale [0, 1, 2]
-- ====================================================================

BEGIN;

-- 1. Elimina tutte le pulizie registrate (completate e incomplete)
DELETE FROM cleaning_tasks;

-- 2. Elimina tutte le assenze settimanali registrate
DELETE FROM weekly_absences;

-- 3. Elimina tutte le segnalazioni di spazzatura (aperte e completate)
DELETE FROM trash_tasks;

-- 4. Elimina tutti i tentativi di login registrati (reset rate-limiting)
DELETE FROM login_attempts;

-- 5. Ripristina la coda della spazzatura all'ordine base [0, 1, 2]
INSERT INTO house_config (id, trash_queue, updated_at)
VALUES ('default', '{0, 1, 2}', NOW())
ON CONFLICT (id) DO UPDATE
SET trash_queue = '{0, 1, 2}',
    updated_at = NOW();

COMMIT;
