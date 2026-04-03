-- Prompt Templates
CREATE TABLE IF NOT EXISTS prompt_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Ideation',
    description TEXT NOT NULL DEFAULT '',
    system_prompt TEXT NOT NULL,
    user_prompt TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Benchmark Runs
CREATE TABLE IF NOT EXISTS benchmark_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    input_text TEXT NOT NULL,
    engine_name TEXT NOT NULL,
    model_name TEXT,
    temperature REAL NOT NULL DEFAULT 0.7,
    max_tokens INTEGER NOT NULL DEFAULT 1024,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    output_text TEXT NOT NULL DEFAULT '',
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Chat Sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT 'New Chat',
    mode TEXT NOT NULL DEFAULT 'general',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Untitled',
    content_json TEXT NOT NULL DEFAULT '{}',
    last_opened_at TEXT,
    page_settings_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sheets (table data engine)
CREATE TABLE IF NOT EXISTS sheets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Untitled Sheet',
    columns_json TEXT NOT NULL DEFAULT '[]',
    rows_json TEXT NOT NULL DEFAULT '[]',
    formulas_json TEXT NOT NULL DEFAULT '{}',
    sizes_json TEXT NOT NULL DEFAULT '{}',
    alignments_json TEXT NOT NULL DEFAULT '{}',
    formats_json TEXT NOT NULL DEFAULT '{}',
    last_opened_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Settings (Last session)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Canvases (Infinite Canvas boards)
CREATE TABLE IF NOT EXISTS canvases (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Untitled Canvas',
    canvas_json TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"scale":1}}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- React Flow canvases (nodes/edges JSON for @xyflow/react)
CREATE TABLE IF NOT EXISTS rf_canvases (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'Untitled',
    data TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RSS Feeds
CREATE TABLE IF NOT EXISTS rss_feeds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_fetched_at TIMESTAMP DEFAULT NULL
);

-- RSS Articles
CREATE TABLE IF NOT EXISTS rss_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feed_id INTEGER NOT NULL REFERENCES rss_feeds(id) ON DELETE CASCADE,
  guid TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  summary TEXT DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  image_url TEXT DEFAULT NULL,
  published_at TIMESTAMP DEFAULT NULL,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(feed_id, guid)
);

-- ── Project Management ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pm_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  avatar_color TEXT NOT NULL DEFAULT '#E04E0E',
  initials TEXT NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pm_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '', -- Short code like 'GAME'
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#E04E0E',
  icon TEXT NOT NULL DEFAULT '📋',
  status TEXT NOT NULL DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pm_project_members (
  project_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  PRIMARY KEY (project_id, member_id),
  FOREIGN KEY (project_id) REFERENCES pm_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES pm_members(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pm_sprints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  goal TEXT NOT NULL DEFAULT '',
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES pm_projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pm_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
  project_task_id INTEGER DEFAULT NULL, -- Per-project incrementing ID
  parent_id INTEGER DEFAULT NULL REFERENCES pm_tasks(id) ON DELETE SET NULL,
  sprint_id INTEGER DEFAULT NULL REFERENCES pm_sprints(id) ON DELETE SET NULL,

  item_type TEXT NOT NULL DEFAULT 'task',
  -- epic | feature | story | task | bug | spike

  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  acceptance_criteria TEXT DEFAULT '',

  status TEXT NOT NULL DEFAULT 'new',
  -- new | active | resolved | closed

  priority TEXT NOT NULL DEFAULT 'medium',
  -- critical | high | medium | low

  severity TEXT NOT NULL DEFAULT 'Minor',
  -- Blocker | Major | Minor | UI/UX

  assignee_id INTEGER DEFAULT NULL REFERENCES pm_members(id) ON DELETE SET NULL,
  story_points INTEGER DEFAULT NULL,
  due_date TEXT DEFAULT NULL,
  resolved_date TEXT DEFAULT NULL,
  position INTEGER DEFAULT 0,
  refs_json TEXT NOT NULL DEFAULT '[]',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pm_tasks_project ON pm_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_tasks_proj_task_id ON pm_tasks(project_id, project_task_id);
CREATE INDEX IF NOT EXISTS idx_pm_tasks_parent ON pm_tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_pm_tasks_sprint ON pm_tasks(sprint_id);
CREATE INDEX IF NOT EXISTS idx_pm_tasks_type ON pm_tasks(item_type);
CREATE INDEX IF NOT EXISTS idx_pm_tasks_status ON pm_tasks(status);
CREATE INDEX IF NOT EXISTS idx_pm_tasks_assignee ON pm_tasks(assignee_id);

CREATE TABLE IF NOT EXISTS pm_task_labels (
  task_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  PRIMARY KEY (task_id, label),
  FOREIGN KEY (task_id) REFERENCES pm_tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pm_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  task_id INTEGER DEFAULT NULL,
  member_id INTEGER DEFAULT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES pm_projects(id) ON DELETE CASCADE
);

-- ── Performance indexes ────────────────────────────────────────────────────
-- Speed up ORDER BY updated_at DESC queries used in list endpoints
CREATE INDEX IF NOT EXISTS idx_sheets_updated    ON sheets(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_updated ON documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_canvases_updated  ON rf_canvases(updated_at DESC);

-- Chat messages — filtered/ordered by session_id + created_at
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);

-- RSS articles — filtered by feed_id for feed-specific queries
CREATE INDEX IF NOT EXISTS idx_rss_articles_feed ON rss_articles(feed_id, published_at DESC);

-- PM activity — filtered by project_id
CREATE INDEX IF NOT EXISTS idx_pm_activity_project ON pm_activity(project_id, created_at DESC);

INSERT OR IGNORE INTO pm_members (id, name, email, avatar_color, initials)
VALUES (1, 'Agent Crowner', '', '#E04E0E', 'AC');
UPDATE pm_members SET name = 'Agent Crowner', initials = 'AC', avatar_color = '#E04E0E' WHERE id = 1;

-- ── Deployment mode settings ───────────────────────────────────────────────
INSERT OR IGNORE INTO settings (key, value) VALUES ('deployment_mode', 'local');
INSERT OR IGNORE INTO settings (key, value) VALUES ('server_url', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('server_api_key', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('server_nickname', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('host_port', '8000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('host_api_key', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('setup_completed', 'false');
