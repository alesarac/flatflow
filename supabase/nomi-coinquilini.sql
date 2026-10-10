-- ==============================================================================
-- Flatflow: Personalizzazione nomi dei coinquilini
-- ==============================================================================
-- Esegui questo script dall'Editor SQL della Dashboard di Supabase (SQL Editor)
-- per configurare i nomi effettivi dei 3 coinquilini della casa.
--
-- I tre profili rimangono associati agli ID stabili 0, 1 e 2.
-- Modifica semplicemente i testi tra virgolette singole:

UPDATE roommates
SET name = 'Coinquilino 1'
WHERE id = 0;

UPDATE roommates
SET name = 'Coinquilino 2'
WHERE id = 1;

UPDATE roommates
SET name = 'Coinquilino 3'
WHERE id = 2;

-- Verifica che le modifiche siano state applicate correttamente:
SELECT id, name
FROM roommates
ORDER BY id ASC;
