-- Clients
CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    industry TEXT NOT NULL,
    website TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

-- Brand Profiles
CREATE TABLE IF NOT EXISTS brand_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL UNIQUE,
    tone_of_voice TEXT NOT NULL,
    brand_values TEXT NOT NULL,
    target_audience TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    brief TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    project_type TEXT NOT NULL DEFAULT 'campaign',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Campaign Ideas
CREATE TABLE IF NOT EXISTS campaign_ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    concept_name TEXT NOT NULL,
    rationale TEXT NOT NULL,
    is_selected INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

-- Channel Contents (Copy)
CREATE TABLE IF NOT EXISTS channel_contents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_idea_id INTEGER NOT NULL,
    channel TEXT NOT NULL,
    headline TEXT,
    body TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    FOREIGN KEY (campaign_idea_id) REFERENCES campaign_ideas(id) ON DELETE CASCADE
);

-- Concept Revisions (version history for AI refinements)
CREATE TABLE IF NOT EXISTS concept_revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_idea_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    original_text TEXT NOT NULL,
    refined_text TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_idea_id) REFERENCES campaign_ideas(id) ON DELETE CASCADE
);

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

-- Generation Versions (snapshot history for AI generations)
CREATE TABLE IF NOT EXISTS generation_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    parent_version_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_version_id) REFERENCES generation_versions(id) ON DELETE SET NULL
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Untitled',
    content_json TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sheets (table data engine)
CREATE TABLE IF NOT EXISTS sheets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Untitled Sheet',
    columns_json TEXT NOT NULL DEFAULT '[]',
    rows_json TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Settings (Last session)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Triggers for updated_at
CREATE TRIGGER IF NOT EXISTS idx_clients_updated_at AFTER UPDATE ON clients BEGIN
    UPDATE clients SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS idx_brand_profiles_updated_at AFTER UPDATE ON brand_profiles BEGIN
    UPDATE brand_profiles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS idx_campaigns_updated_at AFTER UPDATE ON campaigns BEGIN
    UPDATE campaigns SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS idx_campaign_ideas_updated_at AFTER UPDATE ON campaign_ideas BEGIN
    UPDATE campaign_ideas SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS idx_channel_contents_updated_at AFTER UPDATE ON channel_contents BEGIN
    UPDATE channel_contents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;