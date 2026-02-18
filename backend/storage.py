import sqlite3
import json
from typing import List, Optional, Dict
import uuid
from backend.models import Client, BrandProfile, Campaign, CampaignStatus, PromptTemplate, ConceptRevision, GenerationVersion, BenchmarkRun, ChatSession, ChatMessage, Document

class DatabaseManager:
    def __init__(self, db_path: str):
        self.db_path = db_path

    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

    def initialize_schema(self, schema_path: str):
        with open(schema_path, 'r') as f:
            schema_script = f.read()
        with self.get_connection() as conn:
            conn.executescript(schema_script)
            # Migrations for existing databases
            self._migrate(conn)

    def _migrate(self, conn):
        """Add columns/tables that may be missing from older databases."""
        cursor = conn.execute("PRAGMA table_info(campaigns)")
        columns = {row["name"] for row in cursor.fetchall()}
        if "project_type" not in columns:
            conn.execute("ALTER TABLE campaigns ADD COLUMN project_type TEXT NOT NULL DEFAULT 'campaign'")
        if "prompt_template_id" not in columns:
            conn.execute("ALTER TABLE campaigns ADD COLUMN prompt_template_id INTEGER REFERENCES prompt_templates(id)")

        # prompt_templates: add category, description, version
        cursor = conn.execute("PRAGMA table_info(prompt_templates)")
        pt_cols = {row["name"] for row in cursor.fetchall()}
        if "category" not in pt_cols:
            conn.execute("ALTER TABLE prompt_templates ADD COLUMN category TEXT NOT NULL DEFAULT 'Ideation'")
        if "description" not in pt_cols:
            conn.execute("ALTER TABLE prompt_templates ADD COLUMN description TEXT NOT NULL DEFAULT ''")
        if "version" not in pt_cols:
            conn.execute("ALTER TABLE prompt_templates ADD COLUMN version INTEGER NOT NULL DEFAULT 1")

        # Ensure chat tables exist for older databases
        conn.execute("""CREATE TABLE IF NOT EXISTS chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL DEFAULT 'New Chat',
            mode TEXT NOT NULL DEFAULT 'general',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )""")
        # Add mode column if missing (upgrade from earlier chat schema)
        cursor = conn.execute("PRAGMA table_info(chat_sessions)")
        cs_cols = {row["name"] for row in cursor.fetchall()}
        if "mode" not in cs_cols:
            conn.execute("ALTER TABLE chat_sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'general'")
        conn.execute("""CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
        )""")

        # Ensure documents table exists
        conn.execute("""CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT 'Untitled',
            content_json TEXT NOT NULL DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )""")

        conn.commit()

class AppRepository:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def set_setting(self, key: str, value: str):
        sql = "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)"
        with self.db.get_connection() as conn:
            conn.execute(sql, (key, value))
            conn.commit()

    def get_setting(self, key: str) -> Optional[str]:
        sql = "SELECT value FROM settings WHERE key = ?"
        with self.db.get_connection() as conn:
            row = conn.execute(sql, (key,)).fetchone()
            return row['value'] if row else None

class ClientRepository:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def create(self, client: Client, profile: Optional[BrandProfile] = None) -> Client:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO clients (name, industry, website) VALUES (?, ?, ?)", 
                           (client.name, client.industry, client.website))
            client_id = cursor.lastrowid
            if profile:
                cursor.execute("INSERT INTO brand_profiles (client_id, tone_of_voice, brand_values, target_audience) VALUES (?, ?, ?, ?)",
                               (client_id, profile.tone_of_voice, profile.brand_values, profile.target_audience))
            conn.commit()
            return self.get_by_id(client_id)

    def get_by_id(self, client_id: int) -> Optional[Client]:
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
            if not row: return None
            client_data = dict(row)
            bp_row = conn.execute("SELECT * FROM brand_profiles WHERE client_id = ?", (client_id,)).fetchone()
            if bp_row:
                client_data["brand_profile"] = dict(bp_row)
            return Client(**client_data)

    def get_all(self) -> List[Client]:
        with self.db.get_connection() as conn:
            rows = conn.execute("SELECT * FROM clients ORDER BY name ASC").fetchall()
            return [Client(**dict(row)) for row in rows]

class CampaignRepository:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def create(self, campaign: Campaign) -> Campaign:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO campaigns (client_id, name, brief, status, project_type, prompt_template_id) VALUES (?, ?, ?, ?, ?, ?)",
                (campaign.client_id, campaign.name, campaign.brief, campaign.status.value, campaign.project_type, campaign.prompt_template_id),
            )
            campaign_id = cursor.lastrowid
            conn.commit()
            return self.get_by_id(campaign_id)

    def get_by_id(self, campaign_id: int) -> Optional[Campaign]:
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT * FROM campaigns WHERE id = ?", (campaign_id,)).fetchone()
            if not row: return None
            
            campaign_data = dict(row)
            # Fetch Ideas
            ideas_rows = conn.execute("SELECT * FROM campaign_ideas WHERE campaign_id = ?", (campaign_id,)).fetchall()
            ideas = []
            for idea_row in ideas_rows:
                idea_dict = dict(idea_row)
                content_rows = conn.execute("SELECT * FROM channel_contents WHERE campaign_idea_id = ?", (idea_dict['id'],)).fetchall()
                idea_dict['content_pieces'] = [dict(c) for c in content_rows]
                ideas.append(idea_dict)
            
            campaign_data['ideas'] = ideas
            return Campaign(**campaign_data)

    def get_by_client(self, client_id: int) -> List[Campaign]:
        with self.db.get_connection() as conn:
            rows = conn.execute("SELECT * FROM campaigns WHERE client_id = ?", (client_id,)).fetchall()
            campaigns = []
            for row in rows:
                c_dict = dict(row)
                ideas_rows = conn.execute("SELECT * FROM campaign_ideas WHERE campaign_id = ?", (c_dict['id'],)).fetchall()
                c_dict['ideas'] = [dict(r) for r in ideas_rows]
                campaigns.append(Campaign(**c_dict))
            return campaigns

    def update_status(self, campaign_id: int, status: CampaignStatus):
        with self.db.get_connection() as conn:
            conn.execute("UPDATE campaigns SET status = ? WHERE id = ?", (status.value, campaign_id))
            conn.commit()

    def save_ideas(self, campaign_id: int, ideas_json: str):
        try:
            ideas = json.loads(ideas_json)
            with self.db.get_connection() as conn:
                conn.execute("DELETE FROM campaign_ideas WHERE campaign_id = ?", (campaign_id,))
                for idea in ideas:
                    conn.execute("""
                        INSERT INTO campaign_ideas (campaign_id, concept_name, rationale)
                        VALUES (?, ?, ?)
                    """, (campaign_id, idea['concept_name'], idea['rationale']))
                conn.commit()
        except Exception as e:
            print(f"Error saving ideas for campaign {campaign_id}: {e}")


class ConceptRevisionRepository:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def create(self, campaign_idea_id: int, field_name: str, original_text: str, refined_text: str, action: str) -> ConceptRevision:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO concept_revisions (campaign_idea_id, field_name, original_text, refined_text, action) VALUES (?, ?, ?, ?, ?)",
                (campaign_idea_id, field_name, original_text, refined_text, action),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM concept_revisions WHERE id = ?", (cursor.lastrowid,)).fetchone()
            return ConceptRevision(**dict(row))

    def get_by_idea_id(self, campaign_idea_id: int) -> List[ConceptRevision]:
        with self.db.get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM concept_revisions WHERE campaign_idea_id = ? ORDER BY created_at ASC",
                (campaign_idea_id,),
            ).fetchall()
            return [ConceptRevision(**dict(r)) for r in rows]


class GenerationVersionRepository:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def create(self, campaign_id: int, content_json: str, parent_version_id: int = None) -> GenerationVersion:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO generation_versions (campaign_id, content, parent_version_id) VALUES (?, ?, ?)",
                (campaign_id, content_json, parent_version_id),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM generation_versions WHERE id = ?", (cursor.lastrowid,)).fetchone()
            return GenerationVersion(**dict(row))

    def get_by_campaign(self, campaign_id: int) -> List[GenerationVersion]:
        with self.db.get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM generation_versions WHERE campaign_id = ? ORDER BY created_at DESC",
                (campaign_id,),
            ).fetchall()
            return [GenerationVersion(**dict(r)) for r in rows]

    def get_by_id(self, version_id: int) -> Optional[GenerationVersion]:
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT * FROM generation_versions WHERE id = ?", (version_id,)).fetchone()
            return GenerationVersion(**dict(row)) if row else None

    def get_latest(self, campaign_id: int) -> Optional[GenerationVersion]:
        with self.db.get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM generation_versions WHERE campaign_id = ? ORDER BY created_at DESC LIMIT 1",
                (campaign_id,),
            ).fetchone()
            return GenerationVersion(**dict(row)) if row else None


class PromptTemplateRepository:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def seed_default(self):
        """Upsert all seed templates from prompts.py.

        Matches on name: inserts new ones, updates existing to latest code.
        Removes the legacy 'Default' template if present.
        """
        from backend.prompts import SEED_TEMPLATES
        with self.db.get_connection() as conn:
            # Remove legacy "Default" row from earlier schema
            conn.execute("DELETE FROM prompt_templates WHERE name = 'Default'")

            existing = {
                row["name"]: row["id"]
                for row in conn.execute("SELECT id, name FROM prompt_templates").fetchall()
            }
            for t in SEED_TEMPLATES:
                if t["name"] in existing:
                    conn.execute(
                        "UPDATE prompt_templates SET category=?, description=?, system_prompt=?, user_prompt=?, version=? WHERE id=?",
                        (t["category"], t["description"], t["system_prompt"], t["user_prompt"], t["version"], existing[t["name"]]),
                    )
                else:
                    conn.execute(
                        "INSERT INTO prompt_templates (name, category, description, system_prompt, user_prompt, version) VALUES (?, ?, ?, ?, ?, ?)",
                        (t["name"], t["category"], t["description"], t["system_prompt"], t["user_prompt"], t["version"]),
                    )
            conn.commit()

    def get_all(self) -> List[PromptTemplate]:
        with self.db.get_connection() as conn:
            rows = conn.execute("SELECT * FROM prompt_templates ORDER BY id ASC").fetchall()
            return [PromptTemplate(**dict(r)) for r in rows]

    def get_by_id(self, template_id: int) -> Optional[PromptTemplate]:
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT * FROM prompt_templates WHERE id = ?", (template_id,)).fetchone()
            return PromptTemplate(**dict(row)) if row else None

    def get_default(self) -> Optional[PromptTemplate]:
        """Return the first generation template (excludes Refine category)."""
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT * FROM prompt_templates WHERE category != 'Refine' ORDER BY id ASC LIMIT 1").fetchone()
            return PromptTemplate(**dict(row)) if row else None

    def get_by_name(self, name: str) -> Optional[PromptTemplate]:
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT * FROM prompt_templates WHERE name = ?", (name,)).fetchone()
            return PromptTemplate(**dict(row)) if row else None

    def create(self, template: PromptTemplate) -> PromptTemplate:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO prompt_templates (name, category, description, system_prompt, user_prompt, version) VALUES (?, ?, ?, ?, ?, ?)",
                (template.name, template.category, template.description, template.system_prompt, template.user_prompt, template.version),
            )
            conn.commit()
            return self.get_by_id(cursor.lastrowid)

    def update(self, template_id: int, template: PromptTemplate) -> Optional[PromptTemplate]:
        with self.db.get_connection() as conn:
            conn.execute(
                "UPDATE prompt_templates SET name=?, category=?, description=?, system_prompt=?, user_prompt=?, version=? WHERE id=?",
                (template.name, template.category, template.description, template.system_prompt, template.user_prompt, template.version, template_id),
            )
            conn.commit()
            return self.get_by_id(template_id)

    def delete(self, template_id: int):
        with self.db.get_connection() as conn:
            conn.execute("DELETE FROM prompt_templates WHERE id = ?", (template_id,))
            conn.commit()


class ChatSessionRepository:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def create(self, title: str = "New Chat", mode: str = "general") -> ChatSession:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO chat_sessions (title, mode) VALUES (?, ?)", (title, mode))
            conn.commit()
            return self.get_by_id(cursor.lastrowid)

    def update_mode(self, session_id: int, mode: str):
        with self.db.get_connection() as conn:
            conn.execute("UPDATE chat_sessions SET mode = ? WHERE id = ?", (mode, session_id))
            conn.commit()

    def get_by_id(self, session_id: int) -> Optional[ChatSession]:
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT * FROM chat_sessions WHERE id = ?", (session_id,)).fetchone()
            return ChatSession(**dict(row)) if row else None

    def get_all(self) -> List[ChatSession]:
        with self.db.get_connection() as conn:
            rows = conn.execute("SELECT * FROM chat_sessions ORDER BY created_at DESC").fetchall()
            return [ChatSession(**dict(r)) for r in rows]

    def delete(self, session_id: int):
        with self.db.get_connection() as conn:
            conn.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
            conn.commit()


class ChatMessageRepository:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def create(self, session_id: int, role: str, content: str) -> ChatMessage:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)",
                (session_id, role, content),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM chat_messages WHERE id = ?", (cursor.lastrowid,)).fetchone()
            return ChatMessage(**dict(row))

    def get_by_session_id(self, session_id: int) -> List[ChatMessage]:
        with self.db.get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC",
                (session_id,),
            ).fetchall()
            return [ChatMessage(**dict(r)) for r in rows]


class BenchmarkRepository:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def create(self, run: BenchmarkRun) -> BenchmarkRun:
        with self.db.get_connection() as conn:
            cursor = conn.execute(
                """INSERT INTO benchmark_runs
                   (input_text, engine_name, model_name, temperature, max_tokens, latency_ms, output_text, error)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (run.input_text, run.engine_name, run.model_name,
                 run.temperature, run.max_tokens, run.latency_ms,
                 run.output_text, run.error),
            )
            conn.commit()
            return self.get_by_id(cursor.lastrowid)

    def get_by_id(self, run_id: int) -> Optional[BenchmarkRun]:
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT * FROM benchmark_runs WHERE id = ?", (run_id,)).fetchone()
            if not row:
                return None
            return BenchmarkRun(**dict(row))

    def get_recent(self, limit: int = 50) -> List[BenchmarkRun]:
        with self.db.get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM benchmark_runs ORDER BY created_at DESC LIMIT ?", (limit,)
            ).fetchall()
            return [BenchmarkRun(**dict(r)) for r in rows]


class DocumentRepository:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def _row_to_document(self, row) -> Document:
        d = dict(row)
        d["content_json"] = json.loads(d["content_json"]) if isinstance(d["content_json"], str) else d["content_json"]
        return Document(**d)

    def create(self, title: str = "Untitled", content_json: dict = None) -> Document:
        doc_id = str(uuid.uuid4())
        content_str = json.dumps(content_json or {})
        with self.db.get_connection() as conn:
            conn.execute(
                "INSERT INTO documents (id, title, content_json) VALUES (?, ?, ?)",
                (doc_id, title, content_str),
            )
            conn.commit()
            return self.get_by_id(doc_id)

    def get_by_id(self, doc_id: str) -> Optional[Document]:
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
            return self._row_to_document(row) if row else None

    def get_all(self) -> List[Document]:
        with self.db.get_connection() as conn:
            rows = conn.execute("SELECT * FROM documents ORDER BY updated_at DESC").fetchall()
            return [self._row_to_document(r) for r in rows]

    def update(self, doc_id: str, title: str = None, content_json: dict = None) -> Optional[Document]:
        with self.db.get_connection() as conn:
            if title is not None:
                conn.execute("UPDATE documents SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (title, doc_id))
            if content_json is not None:
                conn.execute("UPDATE documents SET content_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (json.dumps(content_json), doc_id))
            conn.commit()
            return self.get_by_id(doc_id)
