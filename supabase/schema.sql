-- ==========================================
-- Flatflow — Schema Database Supabase (PostgreSQL)
-- ==========================================

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
  declined_by INT[] NOT NULL DEFAULT '{}',
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  completed_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
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

CREATE INDEX IF NOT EXISTS idx_trash_tasks_status ON trash_tasks(status);
CREATE INDEX IF NOT EXISTS idx_trash_tasks_reported ON trash_tasks(reported_at DESC);

-- 6. Tabella tentativi di login (per rate limiting su IP)
CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGSERIAL PRIMARY KEY,
  ip TEXT NOT NULL,
  attempt_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip, attempt_time);

-- RLS (Row Level Security):
-- I dati sono protetti tramite il secret code della casa verificato dalle API Next.js sul server.
-- Il backend accede tramite Service Role Key o Anon Key autorizzata.
ALTER TABLE house_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE roommates ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE trash_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Criteri di accesso RLS per Supabase: consenti accesso completo con Service Role / Anon
CREATE POLICY "Allow all operations for service role and anon" ON house_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for service role and anon" ON roommates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for service role and anon" ON weekly_absences FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for service role and anon" ON cleaning_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for service role and anon" ON trash_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for service role and anon" ON login_attempts FOR ALL USING (true) WITH CHECK (true);
