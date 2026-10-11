-- ====================================================================
-- FlatLoop — Schema Database Supabase (PostgreSQL)
-- ====================================================================

-- 1. Tabella configurazione casa
CREATE TABLE IF NOT EXISTS house_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  trash_queue INT[] NOT NULL DEFAULT '{0, 1, 2}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserisci configurazione iniziale se assente
INSERT INTO house_config (id, trash_queue)
VALUES ('default', '{0, 1, 2}')
ON CONFLICT (id) DO NOTHING;

-- 2. Tabella coinquilini (posizioni 0, 1, 2)
CREATE TABLE IF NOT EXISTS roommates (
  id INT PRIMARY KEY CHECK (id IN (0, 1, 2)),
  name TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserisci i tre coinquilini iniziali se assenti
INSERT INTO roommates (id, name)
VALUES 
  (0, 'Coinquilino 1'),
  (1, 'Coinquilino 2'),
  (2, 'Coinquilino 3')
ON CONFLICT (id) DO NOTHING;

-- 3. Tabella assenze settimanali
CREATE TABLE IF NOT EXISTS weekly_absences (
  week_key TEXT NOT NULL,
  roommate_id INT NOT NULL REFERENCES roommates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (week_key, roommate_id)
);

-- 4. Tabella pulizie settimanali
CREATE TABLE IF NOT EXISTS cleaning_tasks (
  id TEXT PRIMARY KEY,
  week_key TEXT NOT NULL,
  area_id INT NOT NULL CHECK (area_id IN (0, 1, 2)),
  assigned_to INT REFERENCES roommates(id) ON DELETE SET NULL,
  assigned_to_name TEXT, -- Snapshot storico del nome dell'incaricato
  declined_by INT[] NOT NULL DEFAULT '{}',
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  completed_by_name TEXT,
  completed_by INT REFERENCES roommates(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_cleaning_tasks_week_area UNIQUE (week_key, area_id)
);

CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_week ON cleaning_tasks(week_key);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_completed ON cleaning_tasks(is_completed);

-- 5. Tabella compiti spazzatura
CREATE TABLE IF NOT EXISTS trash_tasks (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed')),
  assigned_to INT REFERENCES roommates(id) ON DELETE SET NULL,
  declined_by INT[] NOT NULL DEFAULT '{}',
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  completed_by_name TEXT
);

-- Vincolo parziale: può esserci AL MASSIMO UNA sola segnalazione di spazzatura aperta alla volta
CREATE UNIQUE INDEX IF NOT EXISTS idx_trash_tasks_single_open 
ON trash_tasks ((1)) 
WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_trash_tasks_status ON trash_tasks(status);
CREATE INDEX IF NOT EXISTS idx_trash_tasks_reported ON trash_tasks(reported_at DESC);

-- 6. Tabella tentativi di login (per rate limiting su IP)
CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGSERIAL PRIMARY KEY,
  ip TEXT NOT NULL,
  attempt_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip, attempt_time);

-- 7. Tabella lista della spesa condivisa
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

CREATE INDEX IF NOT EXISTS idx_shopping_items_is_bought ON shopping_items(is_bought);
CREATE INDEX IF NOT EXISTS idx_shopping_items_created_at ON shopping_items(created_at DESC);

-- ====================================================================
-- SICUREZZA & RLS (Row Level Security)
-- ====================================================================
-- Tutte le tabelle hanno RLS attivo.
-- I ruoli pubblici anon e authenticated NON hanno permessi di accesso alle tabelle.
-- Tutte le operazioni avvengono esclusivamente tramite il backend autorizzato
-- utilizzando la chiave di servizio server-side (service_role).

ALTER TABLE house_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE roommates ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE trash_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;

-- Revoca esplicita dei permessi per i ruoli pubblici/anonimi
REVOKE ALL ON house_config FROM anon, authenticated;
REVOKE ALL ON roommates FROM anon, authenticated;
REVOKE ALL ON weekly_absences FROM anon, authenticated;
REVOKE ALL ON cleaning_tasks FROM anon, authenticated;
REVOKE ALL ON trash_tasks FROM anon, authenticated;
REVOKE ALL ON login_attempts FROM anon, authenticated;
REVOKE ALL ON shopping_items FROM anon, authenticated;

-- Rimuovi eventuali policy permissive preesistenti
DROP POLICY IF EXISTS "Allow all operations for service role and anon" ON house_config;
DROP POLICY IF EXISTS "Allow all operations for service role and anon" ON roommates;
DROP POLICY IF EXISTS "Allow all operations for service role and anon" ON weekly_absences;
DROP POLICY IF EXISTS "Allow all operations for service role and anon" ON cleaning_tasks;
DROP POLICY IF EXISTS "Allow all operations for service role and anon" ON trash_tasks;
DROP POLICY IF EXISTS "Allow all operations for service role and anon" ON login_attempts;
DROP POLICY IF EXISTS "Allow all operations for service role and anon" ON shopping_items;

-- Concedi accesso esclusivo al ruolo di servizio (service_role)
GRANT ALL ON house_config TO service_role;
GRANT ALL ON roommates TO service_role;
GRANT ALL ON weekly_absences TO service_role;
GRANT ALL ON cleaning_tasks TO service_role;
GRANT ALL ON trash_tasks TO service_role;
GRANT ALL ON login_attempts TO service_role;
GRANT ALL ON shopping_items TO service_role;

-- Policy esplicite per service_role
CREATE POLICY "Service role full access" ON house_config TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON roommates TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON weekly_absences TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON cleaning_tasks TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON trash_tasks TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON login_attempts TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON shopping_items TO service_role USING (true) WITH CHECK (true);

-- ====================================================================
-- FUNZIONI ATOMICHE (RPC) PER TRANSAZIONI SENZA RACE CONDITIONS
-- ====================================================================

-- Funzione atomica per completare la spazzatura e ruotare la coda
CREATE OR REPLACE FUNCTION rpc_complete_trash(
  p_task_id TEXT,
  p_roommate_id INT,
  p_completed_by_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_task RECORD;
  v_current_queue INT[];
  v_new_queue INT[];
  v_item INT;
BEGIN
  -- Blocca la riga del task con FOR UPDATE per garantire atomicità
  SELECT * INTO v_task
  FROM trash_tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task non trovato';
  END IF;

  IF v_task.status <> 'open' THEN
    RAISE EXCEPTION 'Il compito è già stato completato';
  END IF;

  -- Se il compito aveva un assegnatario, deve corrispondere a chi completa
  IF v_task.assigned_to IS NOT NULL AND v_task.assigned_to <> p_roommate_id THEN
    RAISE EXCEPTION 'Solo l''incaricato assegnato può completare questo compito';
  END IF;

  -- Aggiorna il task a completato
  UPDATE trash_tasks
  SET 
    status = 'completed',
    completed_at = NOW(),
    completed_by_name = p_completed_by_name
  WHERE id = p_task_id;

  -- Blocca e leggi la coda da house_config
  SELECT trash_queue INTO v_current_queue
  FROM house_config
  WHERE id = 'default'
  FOR UPDATE;

  IF v_current_queue IS NULL THEN
    v_current_queue := ARRAY[0, 1, 2];
  END IF;

  -- Riorganizza la coda: rimuovi il coinquilino che ha completato e aggiungilo in fondo
  v_new_queue := ARRAY[]::INT[];
  FOREACH v_item IN ARRAY v_current_queue LOOP
    IF v_item <> p_roommate_id THEN
      v_new_queue := array_append(v_new_queue, v_item);
    END IF;
  END LOOP;
  v_new_queue := array_append(v_new_queue, p_roommate_id);

  -- Aggiorna la coda in house_config
  UPDATE house_config
  SET trash_queue = v_new_queue, updated_at = NOW()
  WHERE id = 'default';

  RETURN jsonb_build_object(
    'success', true,
    'new_queue', v_new_queue
  );
END;
$$;

-- Revoca esecuzione da ruoli non autorizzati e concedi solo a service_role
REVOKE ALL ON FUNCTION rpc_complete_trash(TEXT, INT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION rpc_complete_trash(TEXT, INT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION rpc_complete_trash(TEXT, INT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION rpc_complete_trash(TEXT, INT, TEXT) TO service_role;

