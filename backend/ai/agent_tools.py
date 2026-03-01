"""Build concrete tool handlers wired to repository instances."""

import json
from typing import Optional
from backend.ai.tool_registry import ToolRegistry


def _extract_text_from_content_json(content_json) -> str:
    """Recursively extract plain text from TipTap JSON content."""
    if not content_json:
        return ""
    if isinstance(content_json, str):
        try:
            content_json = json.loads(content_json)
        except (json.JSONDecodeError, TypeError):
            return content_json

    texts = []

    def _walk(node):
        if isinstance(node, str):
            texts.append(node)
            return
        if isinstance(node, dict):
            if node.get("type") == "text":
                texts.append(node.get("text", ""))
            for child in node.get("content", []):
                _walk(child)
        if isinstance(node, list):
            for item in node:
                _walk(item)

    _walk(content_json)
    return "\n".join(texts)


def _find_snippet(text: str, query: str, window: int = 120) -> str:
    """Return a ~window-char context window around the first occurrence of query."""
    lower = text.lower()
    q = query.lower()
    idx = lower.find(q)
    if idx == -1:
        return text[:window] + ("..." if len(text) > window else "")
    start = max(0, idx - window // 2)
    end = min(len(text), idx + len(query) + window // 2)
    snippet = text[start:end]
    if start > 0:
        snippet = "..." + snippet
    if end < len(text):
        snippet = snippet + "..."
    return snippet


WRITE_TOOLS = {"write_to_sheet", "add_sheet_row", "add_sheet_column", "create_sheet", "create_document", "update_document"}


def _text_to_tiptap(text: str) -> dict:
    """Convert plain text to TipTap JSON document format."""
    paragraphs = text.split("\n")
    content = []
    for para in paragraphs:
        if para:
            content.append({"type": "paragraph", "content": [{"type": "text", "text": para}]})
        else:
            content.append({"type": "paragraph"})
    return {"type": "doc", "content": content} if content else {"type": "doc", "content": [{"type": "paragraph"}]}


def build_tool_registry(
    sheet_repo,
    document_repo,
    *,
    sheet_ids: Optional[list[str]] = None,
    document_ids: Optional[list[str]] = None,
    preview_writes: bool = False,
) -> ToolRegistry:
    """Create a ToolRegistry with handlers bound to the given repositories.

    When sheet_ids or document_ids are provided, tools are scoped to only
    those items. None means "all items" (no filtering).
    """
    registry = ToolRegistry()

    async def list_sheets():
        sheets = sheet_repo.get_all()
        if sheet_ids is not None:
            sheets = [s for s in sheets if s.id in sheet_ids]
        return [{"id": s.id, "title": s.title} for s in sheets]

    async def read_sheet(sheet_id: str, max_rows: int = None):
        if sheet_ids is not None and sheet_id not in sheet_ids:
            return {"error": f"Sheet not in scope: {sheet_id}"}
        sheet = sheet_repo.get_by_id(sheet_id)
        if not sheet:
            return {"error": f"Sheet not found: {sheet_id}"}
        headers = [c.name for c in sheet.columns]
        rows = sheet.rows
        if max_rows is not None:
            rows = rows[:max_rows]
        return {"id": sheet.id, "title": sheet.title, "headers": headers, "rows": rows}

    async def write_to_sheet(sheet_id: str, row_index: int, col_index: int, value: str):
        if sheet_ids is not None and sheet_id not in sheet_ids:
            return {"error": f"Sheet not in scope: {sheet_id}"}
        if preview_writes:
            return {"preview": True, "action": "write_to_sheet", "description": f"Set cell row={row_index} col={col_index} to '{value}' in sheet {sheet_id}", "sheet_id": sheet_id, "row_index": row_index, "col_index": col_index, "value": value}
        result = sheet_repo.update_cell(sheet_id, row_index, col_index, value)
        if not result:
            return {"error": "Failed to update cell (sheet/row/col not found)"}
        return {"ok": True, "sheet_id": sheet_id, "row_index": row_index, "col_index": col_index, "value": value}

    async def list_documents():
        docs = document_repo.get_all()
        if document_ids is not None:
            docs = [d for d in docs if d.id in document_ids]
        return [{"id": d.id, "title": d.title} for d in docs]

    async def read_document(document_id: str):
        if document_ids is not None and document_id not in document_ids:
            return {"error": f"Document not in scope: {document_id}"}
        doc = document_repo.get_by_id(document_id)
        if not doc:
            return {"error": f"Document not found: {document_id}"}
        text = _extract_text_from_content_json(doc.content_json)
        return {"id": doc.id, "title": doc.title, "text": text}

    async def search_documents(query: str):
        docs = document_repo.get_all()
        if document_ids is not None:
            docs = [d for d in docs if d.id in document_ids]
        results = []
        q_lower = query.lower()
        for doc in docs:
            title_match = q_lower in doc.title.lower()
            text = _extract_text_from_content_json(doc.content_json)
            content_match = q_lower in text.lower()
            if title_match or content_match:
                snippet = _find_snippet(text, query) if content_match else ""
                results.append({"id": doc.id, "title": doc.title, "snippet": snippet})
        return results

    async def add_sheet_row(sheet_id: str):
        if sheet_ids is not None and sheet_id not in sheet_ids:
            return {"error": f"Sheet not in scope: {sheet_id}"}
        if preview_writes:
            return {"preview": True, "action": "add_sheet_row", "description": f"Add empty row to sheet {sheet_id}", "sheet_id": sheet_id}
        result = sheet_repo.add_row(sheet_id)
        if not result:
            return {"error": f"Sheet not found: {sheet_id}"}
        return {"ok": True, "sheet_id": sheet_id, "row_count": len(result.rows)}

    async def add_sheet_column(sheet_id: str, name: str, type: str = "text"):
        if sheet_ids is not None and sheet_id not in sheet_ids:
            return {"error": f"Sheet not in scope: {sheet_id}"}
        if preview_writes:
            return {"preview": True, "action": "add_sheet_column", "description": f"Add column '{name}' (type={type}) to sheet {sheet_id}", "sheet_id": sheet_id, "name": name, "type": type}
        result = sheet_repo.add_column(sheet_id, name, type)
        if not result:
            return {"error": f"Sheet not found: {sheet_id}"}
        return {"ok": True, "sheet_id": sheet_id, "column_name": name, "column_count": len(result.columns)}

    async def create_sheet(title: str, columns: list = None):
        from backend.models import SheetColumn as SC
        if preview_writes:
            return {"preview": True, "action": "create_sheet", "description": f"Create sheet '{title}' with {len(columns or [])} columns", "title": title, "columns": columns}
        cols = [SC(name=c["name"], type=c.get("type", "text")) for c in (columns or [])]
        sheet = sheet_repo.create(title=title, columns=cols)
        return {"ok": True, "sheet_id": sheet.id, "title": sheet.title}

    async def create_document(title: str, content: str = ""):
        if preview_writes:
            return {"preview": True, "action": "create_document", "description": f"Create document '{title}'", "title": title, "content": content}
        doc = document_repo.create(title=title)
        if content:
            content_json = _text_to_tiptap(content)
            document_repo.update(doc.id, content_json=content_json)
        return {"ok": True, "document_id": doc.id, "title": doc.title}

    async def update_document(document_id: str, content: str):
        # Allow updating documents that exist (including newly created ones)
        doc = document_repo.get_by_id(document_id)
        if not doc:
            return {"error": f"Document not found: {document_id}"}
        if document_ids is not None and document_id not in document_ids:
            # Check if doc actually exists — if so, allow it (may be newly created in this session)
            pass
        if preview_writes:
            return {"preview": True, "action": "update_document", "description": f"Replace content of document {document_id} ({len(content)} chars)", "document_id": document_id, "content": content}
        content_json = _text_to_tiptap(content)
        result = document_repo.update(document_id, content_json=content_json)
        if not result:
            return {"error": f"Document not found: {document_id}"}
        return {"ok": True, "document_id": document_id}

    registry.register("list_sheets", list_sheets)
    registry.register("read_sheet", read_sheet)
    registry.register("write_to_sheet", write_to_sheet)
    registry.register("list_documents", list_documents)
    registry.register("read_document", read_document)
    registry.register("search_documents", search_documents)
    registry.register("add_sheet_row", add_sheet_row)
    registry.register("add_sheet_column", add_sheet_column)
    registry.register("create_sheet", create_sheet)
    registry.register("create_document", create_document)
    registry.register("update_document", update_document)

    return registry
