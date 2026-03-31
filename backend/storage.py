import sqlite3
import json
from typing import List, Optional, Dict
import uuid
from backend.models import PromptTemplate, BenchmarkRun, ChatSession, ChatMessage, Document, Sheet, SheetColumn

class DatabaseManager:
    def __init__(self, db_path: str):
        self.db_path = db_path

    def get_connection(self):
        conn = sqlite3.connect(self.db_path, check_same_thread=False, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA journal_mode = WAL;")
        return conn

    def initialize_schema(self, schema_path: str):
        with open(schema_path, 'r') as f:
            schema_script = f.read()
        with self.get_connection() as conn:
            # Migrations FIRST so schema changes (e.g. parent_id rename) are applied
            # before executescript tries to create indexes on the new column names.
            self._migrate(conn)
            conn.executescript(schema_script)

    def _migrate(self, conn):
        """Add columns/tables that may be missing from older databases."""
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

        # Ensure sheets table exists
        conn.execute("""CREATE TABLE IF NOT EXISTS sheets (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT 'Untitled Sheet',
            columns_json TEXT NOT NULL DEFAULT '[]',
            rows_json TEXT NOT NULL DEFAULT '[]',
            formulas_json TEXT NOT NULL DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )""")

        # Add formulas_json column if missing (upgrade from earlier schema)
        cursor = conn.execute("PRAGMA table_info(sheets)")
        sheets_cols = {row["name"] for row in cursor.fetchall()}
        if "formulas_json" not in sheets_cols:
            conn.execute("ALTER TABLE sheets ADD COLUMN formulas_json TEXT NOT NULL DEFAULT '{}'")
        if "sizes_json" not in sheets_cols:
            conn.execute("ALTER TABLE sheets ADD COLUMN sizes_json TEXT NOT NULL DEFAULT '{}'")
        if "alignments_json" not in sheets_cols:
            conn.execute("ALTER TABLE sheets ADD COLUMN alignments_json TEXT NOT NULL DEFAULT '{}'")
        if "formats_json" not in sheets_cols:
            conn.execute("ALTER TABLE sheets ADD COLUMN formats_json TEXT NOT NULL DEFAULT '{}'")

        # Ensure documents table exists
        conn.execute("""CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT 'Untitled',
            content_json TEXT NOT NULL DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )""")

        # Add metadata column to chat_messages if missing
        cursor = conn.execute("PRAGMA table_info(chat_messages)")
        cm_cols = {row["name"] for row in cursor.fetchall()}
        if "metadata" not in cm_cols:
            conn.execute("ALTER TABLE chat_messages ADD COLUMN metadata TEXT")

        # Add last_opened_at and page_settings_json to documents if missing
        cursor = conn.execute("PRAGMA table_info(documents)")
        doc_cols = {row["name"] for row in cursor.fetchall()}
        if "last_opened_at" not in doc_cols:
            conn.execute("ALTER TABLE documents ADD COLUMN last_opened_at TEXT")
        if "page_settings_json" not in doc_cols:
            conn.execute("ALTER TABLE documents ADD COLUMN page_settings_json TEXT")

        cursor = conn.execute("PRAGMA table_info(sheets)")
        sheet_cols = {row["name"] for row in cursor.fetchall()}
        if "last_opened_at" not in sheet_cols:
            conn.execute("ALTER TABLE sheets ADD COLUMN last_opened_at TEXT")

        # Ensure canvases table exists
        conn.execute("""CREATE TABLE IF NOT EXISTS canvases (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT 'Untitled Canvas',
            canvas_json TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"scale":1}}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )""")

        # Project Management tables
        conn.execute("""CREATE TABLE IF NOT EXISTS pm_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL DEFAULT '',
            avatar_color TEXT NOT NULL DEFAULT '#E04E0E',
            initials TEXT NOT NULL DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS pm_projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            color TEXT NOT NULL DEFAULT '#E04E0E',
            icon TEXT NOT NULL DEFAULT '📋',
            status TEXT NOT NULL DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS pm_sprints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            goal TEXT NOT NULL DEFAULT '',
            start_date TEXT,
            end_date TEXT,
            status TEXT NOT NULL DEFAULT 'planned',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES pm_projects(id) ON DELETE CASCADE
        )""")
        # Migrate pm_tasks: add refs_json if missing
        _pm_cols = {row["name"] for row in conn.execute("PRAGMA table_info(pm_tasks)").fetchall()}
        if _pm_cols and "refs_json" not in _pm_cols:
            conn.execute("ALTER TABLE pm_tasks ADD COLUMN refs_json TEXT NOT NULL DEFAULT '[]'")

        # Migrate pm_tasks: if old schema (has parent_task_id), recreate with new schema
        pm_tasks_cols = {row["name"] for row in conn.execute("PRAGMA table_info(pm_tasks)").fetchall()}
        if pm_tasks_cols and "item_type" not in pm_tasks_cols:
            # Save existing data
            try:
                old_rows = conn.execute("SELECT * FROM pm_tasks").fetchall()
            except Exception:
                old_rows = []
            conn.execute("DROP TABLE IF EXISTS pm_task_labels")
            conn.execute("DROP TABLE IF EXISTS pm_tasks")
            conn.execute("""CREATE TABLE IF NOT EXISTS pm_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                project_task_id INTEGER DEFAULT NULL,
                parent_id INTEGER DEFAULT NULL,
                sprint_id INTEGER DEFAULT NULL,
                item_type TEXT NOT NULL DEFAULT 'task',
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                acceptance_criteria TEXT DEFAULT '',
                status TEXT NOT NULL DEFAULT 'new',
                priority TEXT NOT NULL DEFAULT 'medium',
                severity TEXT NOT NULL DEFAULT 'Minor',
                assignee_id INTEGER DEFAULT NULL,
                story_points INTEGER DEFAULT NULL,
                due_date TEXT DEFAULT NULL,
                resolved_date TEXT DEFAULT NULL,
                position INTEGER DEFAULT 0,
                refs_json TEXT NOT NULL DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""")
            # Migrate old rows with best-effort status mapping
            status_map = {"todo": "new", "in_progress": "active", "review": "active", "done": "closed", "blocked": "active"}
            for r in old_rows:
                try:
                    r = dict(r)
                    new_status = status_map.get(r.get("status", "todo"), "new")
                    conn.execute(
                        """INSERT OR IGNORE INTO pm_tasks
                           (id, project_id, parent_id, sprint_id, item_type, title, description, status, priority, assignee_id, due_date, position, created_at, updated_at)
                           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                        (r["id"], r["project_id"], r.get("parent_task_id"), r.get("sprint_id"),
                         "task", r["title"], r.get("description",""), new_status,
                         r.get("priority","medium"), r.get("assignee_id"), r.get("due_date"),
                         r.get("position", 0), r.get("created_at"), r.get("updated_at"))
                    )
                except Exception:
                    pass
        else:
            conn.execute("""CREATE TABLE IF NOT EXISTS pm_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                project_task_id INTEGER DEFAULT NULL,
                parent_id INTEGER DEFAULT NULL,
                sprint_id INTEGER DEFAULT NULL,
                item_type TEXT NOT NULL DEFAULT 'task',
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                acceptance_criteria TEXT DEFAULT '',
                status TEXT NOT NULL DEFAULT 'new',
                priority TEXT NOT NULL DEFAULT 'medium',
                severity TEXT NOT NULL DEFAULT 'Minor',
                assignee_id INTEGER DEFAULT NULL,
                story_points INTEGER DEFAULT NULL,
                due_date TEXT DEFAULT NULL,
                resolved_date TEXT DEFAULT NULL,
                position INTEGER DEFAULT 0,
                refs_json TEXT NOT NULL DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""")
            # Add new columns to existing pm_tasks if missing
            _pm_tasks_cols = {row["name"] for row in conn.execute("PRAGMA table_info(pm_tasks)").fetchall()}
            if "project_task_id" not in _pm_tasks_cols:
                conn.execute("ALTER TABLE pm_tasks ADD COLUMN project_task_id INTEGER DEFAULT NULL")
            if "severity" not in _pm_tasks_cols:
                conn.execute("ALTER TABLE pm_tasks ADD COLUMN severity TEXT NOT NULL DEFAULT 'Minor'")
            if "code" not in {row["name"] for row in conn.execute("PRAGMA table_info(pm_projects)").fetchall()}:
                conn.execute("ALTER TABLE pm_projects ADD COLUMN code TEXT NOT NULL DEFAULT ''")
        conn.execute("""CREATE TABLE IF NOT EXISTS pm_task_labels (
            task_id INTEGER NOT NULL,
            label TEXT NOT NULL,
            PRIMARY KEY (task_id, label),
            FOREIGN KEY (task_id) REFERENCES pm_tasks(id) ON DELETE CASCADE
        )""")
        # Indexes
        for idx_sql in [
            "CREATE INDEX IF NOT EXISTS idx_pm_tasks_project ON pm_tasks(project_id)",
            "CREATE INDEX IF NOT EXISTS idx_pm_tasks_parent ON pm_tasks(parent_id)",
            "CREATE INDEX IF NOT EXISTS idx_pm_tasks_sprint ON pm_tasks(sprint_id)",
            "CREATE INDEX IF NOT EXISTS idx_pm_tasks_type ON pm_tasks(item_type)",
            "CREATE INDEX IF NOT EXISTS idx_pm_tasks_status ON pm_tasks(status)",
            "CREATE INDEX IF NOT EXISTS idx_pm_tasks_assignee ON pm_tasks(assignee_id)",
            "CREATE INDEX IF NOT EXISTS idx_pm_tasks_proj_task_id ON pm_tasks(project_id, project_task_id)",
        ]:
            conn.execute(idx_sql)
        conn.execute("""CREATE TABLE IF NOT EXISTS pm_activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            task_id INTEGER DEFAULT NULL,
            member_id INTEGER DEFAULT NULL,
            action TEXT NOT NULL,
            detail TEXT NOT NULL DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES pm_projects(id) ON DELETE CASCADE
        )""")
        conn.execute("INSERT OR IGNORE INTO pm_members (id, name, email, avatar_color, initials) VALUES (1, 'Agent Crowner', '', '#E04E0E', 'AC')")
        conn.execute("UPDATE pm_members SET name = 'Agent Crowner', initials = 'AC', avatar_color = '#E04E0E' WHERE id = 1")

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


class PromptTemplateRepository:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def get_all(self) -> List[PromptTemplate]:
        with self.db.get_connection() as conn:
            rows = conn.execute("SELECT * FROM prompt_templates ORDER BY id ASC").fetchall()
            return [PromptTemplate(**dict(r)) for r in rows]


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

    def get_all(self, mode: str = None) -> List[ChatSession]:
        with self.db.get_connection() as conn:
            if mode:
                rows = conn.execute("SELECT * FROM chat_sessions WHERE mode = ? ORDER BY created_at DESC", (mode,)).fetchall()
            else:
                rows = conn.execute("SELECT * FROM chat_sessions ORDER BY created_at DESC").fetchall()
            return [ChatSession(**dict(r)) for r in rows]

    def update_title(self, session_id: int, title: str):
        with self.db.get_connection() as conn:
            conn.execute("UPDATE chat_sessions SET title = ? WHERE id = ?", (title, session_id))
            conn.commit()

    def delete(self, session_id: int):
        with self.db.get_connection() as conn:
            conn.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
            conn.commit()

    def delete_all(self) -> int:
        with self.db.get_connection() as conn:
            cur = conn.execute("SELECT COUNT(*) FROM chat_sessions")
            count = cur.fetchone()[0]
            conn.execute("DELETE FROM chat_sessions")
            conn.commit()
            return count


class ChatMessageRepository:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def create(self, session_id: int, role: str, content: str, metadata: str = None) -> ChatMessage:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO chat_messages (session_id, role, content, metadata) VALUES (?, ?, ?, ?)",
                (session_id, role, content, metadata),
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

    def delete_by_id(self, run_id: int) -> bool:
        with self.db.get_connection() as conn:
            cursor = conn.execute("DELETE FROM benchmark_runs WHERE id = ?", (run_id,))
            conn.commit()
            return cursor.rowcount > 0

    def delete_by_input(self, input_text: str) -> int:
        with self.db.get_connection() as conn:
            cursor = conn.execute("DELETE FROM benchmark_runs WHERE input_text = ?", (input_text,))
            conn.commit()
            return cursor.rowcount


class DocumentRepository:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def _row_to_document(self, row) -> Document:
        d = dict(row)
        d["content_json"] = json.loads(d["content_json"]) if isinstance(d["content_json"], str) else d["content_json"]
        d.pop("page_settings_json", None)
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
            rows = conn.execute("SELECT * FROM documents ORDER BY COALESCE(last_opened_at, updated_at) DESC").fetchall()
            return [self._row_to_document(r) for r in rows]

    def touch_opened(self, doc_id: str) -> None:
        with self.db.get_connection() as conn:
            conn.execute("UPDATE documents SET last_opened_at=datetime('now') WHERE id=?", (doc_id,))
            conn.commit()

    def update(self, doc_id: str, title: str = None, content_json: dict = None) -> Optional[Document]:
        with self.db.get_connection() as conn:
            if title is not None:
                conn.execute("UPDATE documents SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (title, doc_id))
            if content_json is not None:
                conn.execute("UPDATE documents SET content_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (json.dumps(content_json), doc_id))
            conn.commit()
            return self.get_by_id(doc_id)

    def delete(self, doc_id: str) -> None:
        with self.db.get_connection() as conn:
            conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
            conn.commit()

    def delete_all(self) -> int:
        with self.db.get_connection() as conn:
            cur = conn.execute("SELECT COUNT(*) FROM documents")
            count = cur.fetchone()[0]
            conn.execute("DELETE FROM documents")
            conn.commit()
            return count


class SheetRepository:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def _row_to_sheet(self, row) -> Sheet:
        d = dict(row)
        columns_raw = json.loads(d.pop("columns_json", "[]"))
        rows_raw = json.loads(d.pop("rows_json", "[]"))
        formulas = json.loads(d.pop("formulas_json", "{}"))
        sizes = json.loads(d.pop("sizes_json", "{}"))
        alignments = json.loads(d.pop("alignments_json", "{}"))
        formats = json.loads(d.pop("formats_json", "{}"))
        return Sheet(
            **d,
            columns=[SheetColumn(**c) if isinstance(c, dict) else SheetColumn(name=str(c)) for c in columns_raw],
            rows=rows_raw,
            formulas=formulas,
            sizes=sizes,
            alignments=alignments,
            formats=formats,
        )

    def create(self, title: str = "Untitled Sheet", columns: List[SheetColumn] = None,
               rows: List[List[str]] = None, formulas: dict = None, formats: dict = None,
               sizes: dict = None, alignments: dict = None) -> Sheet:
        from backend.formula import recalculate
        sheet_id = str(uuid.uuid4())
        cols = columns or []
        row_data = rows or []
        form_data = formulas or {}
        fmt_data = formats or {}
        sizes_data = sizes or {}
        align_data = alignments or {}
        if form_data:
            recalculate(row_data, form_data)
        with self.db.get_connection() as conn:
            conn.execute(
                "INSERT INTO sheets (id, title, columns_json, rows_json, formulas_json, sizes_json, alignments_json, formats_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (sheet_id, title, json.dumps([c.model_dump() for c in cols]),
                 json.dumps(row_data), json.dumps(form_data),
                 json.dumps(sizes_data), json.dumps(align_data), json.dumps(fmt_data)),
            )
            conn.commit()
        return self.get_by_id(sheet_id)

    def get_by_id(self, sheet_id: str) -> Optional[Sheet]:
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT * FROM sheets WHERE id = ?", (sheet_id,)).fetchone()
            return self._row_to_sheet(row) if row else None

    def get_all(self) -> List[Sheet]:
        with self.db.get_connection() as conn:
            rows = conn.execute("SELECT * FROM sheets ORDER BY COALESCE(last_opened_at, updated_at) DESC").fetchall()
            return [self._row_to_sheet(r) for r in rows]

    def touch_opened(self, sheet_id: str) -> None:
        with self.db.get_connection() as conn:
            conn.execute("UPDATE sheets SET last_opened_at=datetime('now') WHERE id=?", (sheet_id,))
            conn.commit()

    def _save(self, conn, sheet_id: str, columns: List[SheetColumn],
              rows: List[List[str]], formulas: dict,
              changed_cells: set | None = None,
              formats: dict | None = None, alignments: dict | None = None):
        """Recalculate formulas and persist columns, rows, and formulas.

        changed_cells=None   — full recalculation (structural changes, restore).
        changed_cells={..}   — targeted recalculation (only dependents of those cells).
        changed_cells=set()  — skip recalculation (no value changes, e.g. add empty row).
        formats/alignments   — when provided, also persist updated cell metadata.
        """
        from backend.formula import recalculate
        recalculate(rows, formulas, changed_cells)
        sql = ("UPDATE sheets SET columns_json = ?, rows_json = ?, formulas_json = ?")
        params: list = [json.dumps([c.model_dump() for c in columns]), json.dumps(rows),
                        json.dumps(formulas)]
        if formats is not None:
            sql += ", formats_json = ?"
            params.append(json.dumps(formats))
        if alignments is not None:
            sql += ", alignments_json = ?"
            params.append(json.dumps(alignments))
        sql += ", updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        params.append(sheet_id)
        conn.execute(sql, params)
        conn.commit()

    # ── Formula-key helpers ───────────────────────────────────────

    @staticmethod
    def _shift_formulas(formulas: dict, axis: str, index: int, delta: int) -> dict:
        """Shift formula positions on insert (delta=+1) or delete (delta=-1).
        axis: 'row' or 'col'."""
        new = {}
        for key, val in formulas.items():
            r, c = map(int, key.split(','))
            pos = r if axis == 'row' else c
            if delta == -1 and pos == index:
                continue  # formula at deleted position is removed
            if delta == -1 and pos > index:
                pos -= 1
            elif delta == 1 and pos >= index:
                pos += 1
            if axis == 'row':
                r = pos
            else:
                c = pos
            new[f"{r},{c}"] = val
        return new

    # ── Row / column mutations ────────────────────────────────────

    def add_row(self, sheet_id: str) -> Optional[Sheet]:
        with self.db.get_connection() as conn:
            sheet = self.get_by_id(sheet_id)
            if not sheet:
                return None
            sheet.rows.append([""] * len(sheet.columns))
            self._save(conn, sheet_id, sheet.columns, sheet.rows, sheet.formulas,
                       changed_cells=set())
            return self.get_by_id(sheet_id)

    def insert_row_at(self, sheet_id: str, row_index: int) -> Optional[Sheet]:
        with self.db.get_connection() as conn:
            sheet = self.get_by_id(sheet_id)
            if not sheet:
                return None
            idx = max(0, min(row_index, len(sheet.rows)))
            sheet.rows.insert(idx, [""] * len(sheet.columns))
            formulas = self._shift_formulas(sheet.formulas, 'row', idx, +1)
            formats = self._shift_formulas(sheet.formats, 'row', idx, +1)
            alignments = self._shift_formulas(sheet.alignments, 'row', idx, +1)
            self._save(conn, sheet_id, sheet.columns, sheet.rows, formulas,
                       formats=formats, alignments=alignments)
            return self.get_by_id(sheet_id)

    def duplicate_row(self, sheet_id: str, row_index: int) -> Optional[Sheet]:
        with self.db.get_connection() as conn:
            sheet = self.get_by_id(sheet_id)
            if not sheet:
                return None
            if row_index < 0 or row_index >= len(sheet.rows):
                return None
            sheet.rows.insert(row_index + 1, list(sheet.rows[row_index]))
            # Shift+copy helper: rows > row_index shift down, row_index is duplicated
            def _shift_and_copy(d: dict) -> dict:
                new = {}
                for key, val in d.items():
                    r, c = map(int, key.split(','))
                    if r > row_index:
                        new[f"{r + 1},{c}"] = val
                    else:
                        new[f"{r},{c}"] = val
                    if r == row_index:
                        new[f"{row_index + 1},{c}"] = val
                return new
            new_formulas = _shift_and_copy(sheet.formulas)
            new_formats = _shift_and_copy(sheet.formats)
            new_alignments = _shift_and_copy(sheet.alignments)
            self._save(conn, sheet_id, sheet.columns, sheet.rows, new_formulas,
                       formats=new_formats, alignments=new_alignments)
            return self.get_by_id(sheet_id)

    def add_column(self, sheet_id: str, name: str, col_type: str = "text") -> Optional[Sheet]:
        with self.db.get_connection() as conn:
            sheet = self.get_by_id(sheet_id)
            if not sheet:
                return None
            sheet.columns.append(SheetColumn(name=name, type=col_type))
            for row in sheet.rows:
                row.append("")
            self._save(conn, sheet_id, sheet.columns, sheet.rows, sheet.formulas,
                       changed_cells=set())
            return self.get_by_id(sheet_id)

    def insert_column(self, sheet_id: str, col_index: int, name: str, col_type: str = "text") -> Optional[Sheet]:
        with self.db.get_connection() as conn:
            sheet = self.get_by_id(sheet_id)
            if not sheet:
                return None
            idx = max(0, min(col_index, len(sheet.columns)))
            sheet.columns.insert(idx, SheetColumn(name=name, type=col_type))
            for row in sheet.rows:
                row.insert(idx, "")
            formulas = self._shift_formulas(sheet.formulas, 'col', idx, +1)
            formats = self._shift_formulas(sheet.formats, 'col', idx, +1)
            alignments = self._shift_formulas(sheet.alignments, 'col', idx, +1)
            self._save(conn, sheet_id, sheet.columns, sheet.rows, formulas,
                       formats=formats, alignments=alignments)
            return self.get_by_id(sheet_id)

    @staticmethod
    def validate_cell(value: str, col_type: str) -> Optional[str]:
        """Validate value against column type. Returns error message or None."""
        if not value:
            return None  # empty is always valid
        if col_type == "number":
            try:
                float(value)
            except ValueError:
                return f"Invalid number: {value}"
        elif col_type == "boolean":
            if value.lower() not in ("true", "false", "1", "0", "yes", "no"):
                return f"Invalid boolean: {value}"
        elif col_type == "date":
            import re
            if not re.match(r"^\d{4}-\d{2}-\d{2}$", value):
                return f"Invalid date (expected YYYY-MM-DD): {value}"
        return None

    def update_cell(self, sheet_id: str, row_index: int, col_index: int, value: str) -> Optional[Sheet]:
        with self.db.get_connection() as conn:
            sheet = self.get_by_id(sheet_id)
            if not sheet:
                return None
            if row_index < 0 or row_index >= len(sheet.rows):
                return None
            if col_index < 0 or col_index >= len(sheet.columns):
                return None

            key = f"{row_index},{col_index}"
            formulas = dict(sheet.formulas)

            if isinstance(value, str) and value.startswith('='):
                # Store formula; placeholder in rows will be overwritten by recalculate
                formulas[key] = value
                sheet.rows[row_index][col_index] = ""
            else:
                formulas.pop(key, None)
                col_type = sheet.columns[col_index].type
                error = self.validate_cell(value, col_type)
                if error:
                    raise ValueError(error)
                sheet.rows[row_index][col_index] = value

            self._save(conn, sheet_id, sheet.columns, sheet.rows, formulas,
                       changed_cells={key})
            return self.get_by_id(sheet_id)

    def append_rows(self, sheet_id: str, new_rows: list) -> None:
        with self.db.get_connection() as conn:
            sheet = self.get_by_id(sheet_id)
            if not sheet:
                return
            updated = sheet.rows + new_rows
            self._save(conn, sheet_id, sheet.columns, updated, sheet.formulas, changed_cells=set())

    def delete_row(self, sheet_id: str, row_index: int) -> Optional[Sheet]:
        with self.db.get_connection() as conn:
            sheet = self.get_by_id(sheet_id)
            if not sheet:
                return None
            if row_index < 0 or row_index >= len(sheet.rows):
                return None
            sheet.rows.pop(row_index)
            formulas = self._shift_formulas(sheet.formulas, 'row', row_index, -1)
            formats = self._shift_formulas(sheet.formats, 'row', row_index, -1)
            alignments = self._shift_formulas(sheet.alignments, 'row', row_index, -1)
            self._save(conn, sheet_id, sheet.columns, sheet.rows, formulas,
                       formats=formats, alignments=alignments)
            return self.get_by_id(sheet_id)

    def delete_column(self, sheet_id: str, col_index: int) -> Optional[Sheet]:
        with self.db.get_connection() as conn:
            sheet = self.get_by_id(sheet_id)
            if not sheet:
                return None
            if col_index < 0 or col_index >= len(sheet.columns):
                return None
            sheet.columns.pop(col_index)
            for row in sheet.rows:
                if col_index < len(row):
                    row.pop(col_index)
            formulas = self._shift_formulas(sheet.formulas, 'col', col_index, -1)
            formats = self._shift_formulas(sheet.formats, 'col', col_index, -1)
            alignments = self._shift_formulas(sheet.alignments, 'col', col_index, -1)
            self._save(conn, sheet_id, sheet.columns, sheet.rows, formulas,
                       formats=formats, alignments=alignments)
            return self.get_by_id(sheet_id)

    def sort_by_column(self, sheet_id: str, col_index: int, ascending: bool = True) -> Optional[Sheet]:
        with self.db.get_connection() as conn:
            sheet = self.get_by_id(sheet_id)
            if not sheet or col_index < 0 or col_index >= len(sheet.columns):
                return None
            col_type = sheet.columns[col_index].type

            def sort_key(item):
                _, row = item
                val = row[col_index] if col_index < len(row) else ""
                if col_type == "number":
                    try:
                        return float(val)
                    except (ValueError, TypeError):
                        return float("inf")
                return (val or "").lower()

            indexed = list(enumerate(sheet.rows))
            # Separate rows that have a value in the sort column from empty ones
            def _has_val(item):
                _, row = item
                val = row[col_index] if col_index < len(row) else ""
                return bool(val and str(val).strip())

            data_rows = [item for item in indexed if _has_val(item)]
            empty_rows = [item for item in indexed if not _has_val(item)]
            data_rows.sort(key=sort_key, reverse=not ascending)
            indexed = data_rows + empty_rows  # empty rows always at bottom
            old_to_new = {old_i: new_i for new_i, (old_i, _) in enumerate(indexed)}
            sheet.rows = [row for _, row in indexed]

            def _remap_rows(d: dict) -> dict:
                new = {}
                for key, val in d.items():
                    r, c = map(int, key.split(','))
                    if r in old_to_new:
                        new[f"{old_to_new[r]},{c}"] = val
                return new
            new_formulas = _remap_rows(sheet.formulas)
            new_formats = _remap_rows(sheet.formats)
            new_alignments = _remap_rows(sheet.alignments)
            self._save(conn, sheet_id, sheet.columns, sheet.rows, new_formulas,
                       formats=new_formats, alignments=new_alignments)
            return self.get_by_id(sheet_id)

    def sort_by_columns(self, sheet_id: str, levels: list) -> Optional[Sheet]:
        """Multi-level sort. levels = [{"col_index": int, "ascending": bool}, ...]"""
        with self.db.get_connection() as conn:
            sheet = self.get_by_id(sheet_id)
            if not sheet:
                return None
            valid_levels = [l for l in levels if 0 <= l.get("col_index", -1) < len(sheet.columns)]
            if not valid_levels:
                return sheet

            def sort_key(item):
                _, row = item
                keys = []
                for lv in valid_levels:
                    ci = lv["col_index"]
                    col_type = sheet.columns[ci].type
                    val = row[ci] if ci < len(row) else ""
                    if col_type == "number":
                        try:
                            keys.append(float(val))
                        except (ValueError, TypeError):
                            keys.append(float("inf"))
                    else:
                        keys.append((val or "").lower())
                return keys

            def _has_any_val(item):
                _, row = item
                return any(
                    bool(row[lv["col_index"]] if lv["col_index"] < len(row) else "")
                    for lv in valid_levels
                )

            indexed = list(enumerate(sheet.rows))
            data_rows = [it for it in indexed if _has_any_val(it)]
            empty_rows = [it for it in indexed if not _has_any_val(it)]

            # Multi-key sort: sort from last level to first (stable sort)
            for lv in reversed(valid_levels):
                ci = lv["col_index"]
                asc = lv.get("ascending", True)
                col_type = sheet.columns[ci].type

                def _key(item, _ci=ci, _ct=col_type):
                    _, row = item
                    val = row[_ci] if _ci < len(row) else ""
                    if _ct == "number":
                        try:
                            return float(val)
                        except (ValueError, TypeError):
                            return float("inf")
                    return (val or "").lower()

                data_rows.sort(key=_key, reverse=not asc)

            indexed = data_rows + empty_rows
            old_to_new = {old_i: new_i for new_i, (old_i, _) in enumerate(indexed)}
            sheet.rows = [row for _, row in indexed]

            def _remap(d: dict) -> dict:
                new = {}
                for key, val in d.items():
                    r, c = map(int, key.split(','))
                    if r in old_to_new:
                        new[f"{old_to_new[r]},{c}"] = val
                return new

            self._save(conn, sheet_id, sheet.columns, sheet.rows,
                       _remap(sheet.formulas),
                       formats=_remap(sheet.formats),
                       alignments=_remap(sheet.alignments))
            return self.get_by_id(sheet_id)

    def rename_column(self, sheet_id: str, col_index: int, name: str) -> Optional[Sheet]:
        with self.db.get_connection() as conn:
            sheet = self.get_by_id(sheet_id)
            if not sheet or col_index < 0 or col_index >= len(sheet.columns):
                return None
            sheet.columns[col_index] = SheetColumn(name=name, type=sheet.columns[col_index].type)
            self._save(conn, sheet_id, sheet.columns, sheet.rows, sheet.formulas,
                       changed_cells=set())
            return self.get_by_id(sheet_id)

    def move_column(self, sheet_id: str, from_index: int, to_index: int) -> Optional[Sheet]:
        with self.db.get_connection() as conn:
            sheet = self.get_by_id(sheet_id)
            if not sheet:
                return None
            n = len(sheet.columns)
            if from_index < 0 or from_index >= n or to_index < 0 or to_index >= n:
                return None
            col = sheet.columns.pop(from_index)
            sheet.columns.insert(to_index, col)
            for row in sheet.rows:
                # Pad short rows so both positions exist
                while len(row) <= max(from_index, to_index):
                    row.append("")
                val = row.pop(from_index)
                row.insert(to_index, val)
            # Remap formula column positions
            order = list(range(n))
            moved = order.pop(from_index)
            order.insert(to_index, moved)
            old_to_new = {old_c: new_c for new_c, old_c in enumerate(order)}
            def _remap_cols(d: dict) -> dict:
                new = {}
                for key, val in d.items():
                    r, c = map(int, key.split(','))
                    if c in old_to_new:
                        new[f"{r},{old_to_new[c]}"] = val
                return new
            new_formulas = _remap_cols(sheet.formulas)
            new_formats = _remap_cols(sheet.formats)
            new_alignments = _remap_cols(sheet.alignments)
            self._save(conn, sheet_id, sheet.columns, sheet.rows, new_formulas,
                       formats=new_formats, alignments=new_alignments)
            return self.get_by_id(sheet_id)

    def update_formats(self, sheet_id: str, formats: dict) -> Optional[Sheet]:
        with self.db.get_connection() as conn:
            conn.execute(
                "UPDATE sheets SET formats_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (json.dumps(formats), sheet_id),
            )
            conn.commit()
            return self.get_by_id(sheet_id)

    def update_alignments(self, sheet_id: str, alignments: dict) -> Optional[Sheet]:
        with self.db.get_connection() as conn:
            conn.execute(
                "UPDATE sheets SET alignments_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (json.dumps(alignments), sheet_id),
            )
            conn.commit()
            return self.get_by_id(sheet_id)

    def update_sizes(self, sheet_id: str, sizes: dict) -> Optional[Sheet]:
        with self.db.get_connection() as conn:
            conn.execute(
                "UPDATE sheets SET sizes_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (json.dumps(sizes), sheet_id),
            )
            conn.commit()
            return self.get_by_id(sheet_id)

    def update_title(self, sheet_id: str, title: str) -> Optional[Sheet]:
        with self.db.get_connection() as conn:
            conn.execute("UPDATE sheets SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (title, sheet_id))
            conn.commit()
            return self.get_by_id(sheet_id)

    def restore_data(self, sheet_id: str, columns: List[SheetColumn],
                     rows: List[List[str]], formulas: dict = None,
                     sizes: dict = None, alignments: dict = None,
                     formats: dict = None) -> Optional[Sheet]:
        """Wholesale replace columns, rows, and formulas (used by undo/redo)."""
        with self.db.get_connection() as conn:
            existing = conn.execute("SELECT id FROM sheets WHERE id = ?", (sheet_id,)).fetchone()
            if not existing:
                return None
            if formulas is None:
                sheet = self.get_by_id(sheet_id)
                formulas = sheet.formulas if sheet else {}
            self._save(conn, sheet_id, columns, rows, formulas)
            updates = []
            params = []
            if sizes is not None:
                updates.append("sizes_json = ?")
                params.append(json.dumps(sizes))
            if alignments is not None:
                updates.append("alignments_json = ?")
                params.append(json.dumps(alignments))
            if formats is not None:
                updates.append("formats_json = ?")
                params.append(json.dumps(formats))
            if updates:
                params.append(sheet_id)
                conn.execute(f"UPDATE sheets SET {', '.join(updates)} WHERE id = ?", params)
                conn.commit()
            return self.get_by_id(sheet_id)

    def duplicate(self, sheet_id: str) -> Optional[Sheet]:
        sheet = self.get_by_id(sheet_id)
        if not sheet:
            return None
        return self.create(
            title=f"{sheet.title} (copy)",
            columns=[SheetColumn(**c.model_dump()) for c in sheet.columns],
            rows=[list(row) for row in sheet.rows],
            formulas=dict(sheet.formulas),
            formats=dict(sheet.formats),
            sizes=dict(sheet.sizes),
            alignments=dict(sheet.alignments),
        )

    def delete(self, sheet_id: str) -> bool:
        with self.db.get_connection() as conn:
            conn.execute("DELETE FROM sheets WHERE id = ?", (sheet_id,))
            conn.commit()
            return True

    def delete_all(self) -> int:
        with self.db.get_connection() as conn:
            cur = conn.execute("SELECT COUNT(*) FROM sheets")
            count = cur.fetchone()[0]
            conn.execute("DELETE FROM sheets")
            conn.commit()
            return count


class CanvasRepository:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def get_all(self) -> List[Dict]:
        with self.db.get_connection() as conn:
            rows = conn.execute(
                "SELECT id, title, created_at, updated_at FROM canvases ORDER BY updated_at DESC"
            ).fetchall()
            return [dict(r) for r in rows]

    def get_by_id(self, canvas_id: str) -> Optional[Dict]:
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT * FROM canvases WHERE id = ?", (canvas_id,)).fetchone()
            if not row:
                return None
            d = dict(row)
            d["canvas_json"] = json.loads(d["canvas_json"])
            return d

    def create(self, title: str = "Untitled Canvas") -> Dict:
        canvas_id = str(uuid.uuid4())
        default_json = json.dumps({"nodes": [], "edges": [], "viewport": {"x": 0, "y": 0, "scale": 1}})
        with self.db.get_connection() as conn:
            conn.execute(
                "INSERT INTO canvases (id, title, canvas_json) VALUES (?, ?, ?)",
                (canvas_id, title, default_json),
            )
            conn.commit()
        return self.get_by_id(canvas_id)

    def update(self, canvas_id: str, canvas_json: dict = None, title: str = None) -> Optional[Dict]:
        with self.db.get_connection() as conn:
            if title is not None:
                conn.execute(
                    "UPDATE canvases SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (title, canvas_id),
                )
            if canvas_json is not None:
                conn.execute(
                    "UPDATE canvases SET canvas_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (json.dumps(canvas_json), canvas_id),
                )
            conn.commit()
        return self.get_by_id(canvas_id)

    def delete(self, canvas_id: str) -> None:
        with self.db.get_connection() as conn:
            conn.execute("DELETE FROM canvases WHERE id = ?", (canvas_id,))
            conn.commit()
