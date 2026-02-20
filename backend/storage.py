import sqlite3
import json
from typing import List, Optional, Dict
import uuid
from backend.models import PromptTemplate, BenchmarkRun, ChatSession, ChatMessage, Document, Sheet, SheetColumn

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


class SheetRepository:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def _row_to_sheet(self, row) -> Sheet:
        d = dict(row)
        columns_raw = json.loads(d.pop("columns_json", "[]"))
        rows_raw = json.loads(d.pop("rows_json", "[]"))
        formulas = json.loads(d.pop("formulas_json", "{}"))
        return Sheet(
            **d,
            columns=[SheetColumn(**c) if isinstance(c, dict) else SheetColumn(name=str(c)) for c in columns_raw],
            rows=rows_raw,
            formulas=formulas,
        )

    def create(self, title: str = "Untitled Sheet", columns: List[SheetColumn] = None,
               rows: List[List[str]] = None, formulas: dict = None) -> Sheet:
        from backend.formula import recalculate
        sheet_id = str(uuid.uuid4())
        cols = columns or []
        row_data = rows or []
        form_data = formulas or {}
        if form_data:
            recalculate(row_data, form_data)
        with self.db.get_connection() as conn:
            conn.execute(
                "INSERT INTO sheets (id, title, columns_json, rows_json, formulas_json) VALUES (?, ?, ?, ?, ?)",
                (sheet_id, title, json.dumps([c.model_dump() for c in cols]),
                 json.dumps(row_data), json.dumps(form_data)),
            )
            conn.commit()
        return self.get_by_id(sheet_id)

    def get_by_id(self, sheet_id: str) -> Optional[Sheet]:
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT * FROM sheets WHERE id = ?", (sheet_id,)).fetchone()
            return self._row_to_sheet(row) if row else None

    def get_all(self) -> List[Sheet]:
        with self.db.get_connection() as conn:
            rows = conn.execute("SELECT * FROM sheets ORDER BY updated_at DESC").fetchall()
            return [self._row_to_sheet(r) for r in rows]

    def _save(self, conn, sheet_id: str, columns: List[SheetColumn],
              rows: List[List[str]], formulas: dict):
        """Recalculate formulas and persist columns, rows, and formulas."""
        from backend.formula import recalculate
        recalculate(rows, formulas)
        conn.execute(
            "UPDATE sheets SET columns_json = ?, rows_json = ?, formulas_json = ?, "
            "updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (json.dumps([c.model_dump() for c in columns]), json.dumps(rows),
             json.dumps(formulas), sheet_id),
        )
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
            self._save(conn, sheet_id, sheet.columns, sheet.rows, sheet.formulas)
            return self.get_by_id(sheet_id)

    def insert_row_at(self, sheet_id: str, row_index: int) -> Optional[Sheet]:
        with self.db.get_connection() as conn:
            sheet = self.get_by_id(sheet_id)
            if not sheet:
                return None
            idx = max(0, min(row_index, len(sheet.rows)))
            sheet.rows.insert(idx, [""] * len(sheet.columns))
            formulas = self._shift_formulas(sheet.formulas, 'row', idx, +1)
            self._save(conn, sheet_id, sheet.columns, sheet.rows, formulas)
            return self.get_by_id(sheet_id)

    def duplicate_row(self, sheet_id: str, row_index: int) -> Optional[Sheet]:
        with self.db.get_connection() as conn:
            sheet = self.get_by_id(sheet_id)
            if not sheet:
                return None
            if row_index < 0 or row_index >= len(sheet.rows):
                return None
            sheet.rows.insert(row_index + 1, list(sheet.rows[row_index]))
            # Shift formulas at row > row_index, then copy formulas at row_index
            new_formulas = {}
            for key, val in sheet.formulas.items():
                r, c = map(int, key.split(','))
                if r > row_index:
                    new_formulas[f"{r + 1},{c}"] = val
                else:
                    new_formulas[f"{r},{c}"] = val
                if r == row_index:
                    new_formulas[f"{row_index + 1},{c}"] = val
            self._save(conn, sheet_id, sheet.columns, sheet.rows, new_formulas)
            return self.get_by_id(sheet_id)

    def add_column(self, sheet_id: str, name: str, col_type: str = "text") -> Optional[Sheet]:
        with self.db.get_connection() as conn:
            sheet = self.get_by_id(sheet_id)
            if not sheet:
                return None
            sheet.columns.append(SheetColumn(name=name, type=col_type))
            for row in sheet.rows:
                row.append("")
            self._save(conn, sheet_id, sheet.columns, sheet.rows, sheet.formulas)
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

            self._save(conn, sheet_id, sheet.columns, sheet.rows, formulas)
            return self.get_by_id(sheet_id)

    def delete_row(self, sheet_id: str, row_index: int) -> Optional[Sheet]:
        with self.db.get_connection() as conn:
            sheet = self.get_by_id(sheet_id)
            if not sheet:
                return None
            if row_index < 0 or row_index >= len(sheet.rows):
                return None
            sheet.rows.pop(row_index)
            formulas = self._shift_formulas(sheet.formulas, 'row', row_index, -1)
            self._save(conn, sheet_id, sheet.columns, sheet.rows, formulas)
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
            self._save(conn, sheet_id, sheet.columns, sheet.rows, formulas)
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
                if not val:
                    return (1, "")  # empty last
                if col_type == "number":
                    try:
                        return (0, float(val))
                    except ValueError:
                        return (1, val)
                return (0, val.lower())

            indexed = list(enumerate(sheet.rows))
            indexed.sort(key=sort_key, reverse=not ascending)
            old_to_new = {old_i: new_i for new_i, (old_i, _) in enumerate(indexed)}
            sheet.rows = [row for _, row in indexed]

            new_formulas = {}
            for key, val in sheet.formulas.items():
                r, c = map(int, key.split(','))
                if r in old_to_new:
                    new_formulas[f"{old_to_new[r]},{c}"] = val
            self._save(conn, sheet_id, sheet.columns, sheet.rows, new_formulas)
            return self.get_by_id(sheet_id)

    def rename_column(self, sheet_id: str, col_index: int, name: str) -> Optional[Sheet]:
        with self.db.get_connection() as conn:
            sheet = self.get_by_id(sheet_id)
            if not sheet or col_index < 0 or col_index >= len(sheet.columns):
                return None
            sheet.columns[col_index] = SheetColumn(name=name, type=sheet.columns[col_index].type)
            self._save(conn, sheet_id, sheet.columns, sheet.rows, sheet.formulas)
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
                if from_index < len(row):
                    val = row.pop(from_index)
                    row.insert(to_index, val)
            # Remap formula column positions
            order = list(range(n))
            moved = order.pop(from_index)
            order.insert(to_index, moved)
            old_to_new = {old_c: new_c for new_c, old_c in enumerate(order)}
            new_formulas = {}
            for key, val in sheet.formulas.items():
                r, c = map(int, key.split(','))
                if c in old_to_new:
                    new_formulas[f"{r},{old_to_new[c]}"] = val
            self._save(conn, sheet_id, sheet.columns, sheet.rows, new_formulas)
            return self.get_by_id(sheet_id)

    def update_title(self, sheet_id: str, title: str) -> Optional[Sheet]:
        with self.db.get_connection() as conn:
            conn.execute("UPDATE sheets SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (title, sheet_id))
            conn.commit()
            return self.get_by_id(sheet_id)

    def restore_data(self, sheet_id: str, columns: List[SheetColumn],
                     rows: List[List[str]], formulas: dict = None) -> Optional[Sheet]:
        """Wholesale replace columns, rows, and formulas (used by undo/redo)."""
        with self.db.get_connection() as conn:
            existing = conn.execute("SELECT id FROM sheets WHERE id = ?", (sheet_id,)).fetchone()
            if not existing:
                return None
            if formulas is None:
                sheet = self.get_by_id(sheet_id)
                formulas = sheet.formulas if sheet else {}
            self._save(conn, sheet_id, columns, rows, formulas)
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
        )

    def delete(self, sheet_id: str) -> bool:
        with self.db.get_connection() as conn:
            conn.execute("DELETE FROM sheets WHERE id = ?", (sheet_id,))
            conn.commit()
            return True
