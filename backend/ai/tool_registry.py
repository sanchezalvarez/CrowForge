"""Tool definitions and registry for the AI agent loop."""

import json
from typing import Any, Callable, Awaitable

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "list_sheets",
            "description": "List all sheets in the workspace. Returns [{id, title}].",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_sheet",
            "description": "Read a sheet's headers and rows. Returns {id, title, headers, rows}.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sheet_id": {"type": "string", "description": "The sheet ID to read."},
                    "max_rows": {"type": "integer", "description": "Maximum number of rows to return (default: all)."},
                },
                "required": ["sheet_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_to_sheet",
            "description": "Update a single cell in a sheet.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sheet_id": {"type": "string"},
                    "row_index": {"type": "integer", "description": "Zero-based row index."},
                    "col_index": {"type": "integer", "description": "Zero-based column index."},
                    "value": {"type": "string", "description": "The new cell value."},
                },
                "required": ["sheet_id", "row_index", "col_index", "value"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_documents",
            "description": "List all documents in the workspace. Returns [{id, title}].",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_document",
            "description": "Read a document's content as plain text. Returns {id, title, text}.",
            "parameters": {
                "type": "object",
                "properties": {
                    "document_id": {"type": "string", "description": "The document ID to read."},
                },
                "required": ["document_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_documents",
            "description": "Search documents by title or content. Returns [{id, title, snippet}].",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query string."},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_sheet_row",
            "description": "Add an empty row to the end of a sheet.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sheet_id": {"type": "string", "description": "The sheet ID."},
                },
                "required": ["sheet_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_sheet_column",
            "description": "Add a new column to a sheet.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sheet_id": {"type": "string", "description": "The sheet ID."},
                    "name": {"type": "string", "description": "Column name."},
                    "type": {"type": "string", "description": "Column type: text, number, or boolean. Default: text."},
                },
                "required": ["sheet_id", "name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_sheet",
            "description": "Create a new sheet with optional columns.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Sheet title."},
                    "columns": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "type": {"type": "string", "description": "text, number, or boolean."},
                            },
                            "required": ["name"],
                        },
                        "description": "Optional list of columns.",
                    },
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_document",
            "description": "Create a new document, optionally with initial text content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Document title."},
                    "content": {"type": "string", "description": "Optional initial text content."},
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_document",
            "description": "Replace a document's content with plain text.",
            "parameters": {
                "type": "object",
                "properties": {
                    "document_id": {"type": "string", "description": "The document ID."},
                    "content": {"type": "string", "description": "The new plain text content."},
                },
                "required": ["document_id", "content"],
            },
        },
    },
]


class ToolRegistry:
    """Maps tool names to async handler functions."""

    def __init__(self):
        self._handlers: dict[str, Callable[..., Awaitable[Any]]] = {}

    @property
    def schemas(self) -> list[dict]:
        return [t for t in TOOL_DEFINITIONS if t["function"]["name"] in self._handlers]

    def register(self, name: str, handler: Callable[..., Awaitable[Any]]):
        self._handlers[name] = handler

    async def call(self, name: str, args: dict) -> str:
        handler = self._handlers.get(name)
        if not handler:
            return json.dumps({"error": f"Unknown tool: {name}"})
        try:
            result = await handler(**args)
            return json.dumps(result, default=str)
        except Exception as e:
            return json.dumps({"error": str(e)})
