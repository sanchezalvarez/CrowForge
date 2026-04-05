#!/usr/bin/env python3
"""PocketBase initial schema migration — creates all CrowForge collections.

Usage:
    PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASSWORD=secret \
        python pb_migrations/001_initial_schema.py

Environment variables:
    PB_ADMIN_EMAIL     PocketBase admin email (required)
    PB_ADMIN_PASSWORD  PocketBase admin password (required)
    PB_URL             PocketBase base URL (default: http://127.0.0.1:8090)
"""

import asyncio
import os
import sys

import httpx

PB_URL = os.environ.get("PB_URL", "http://127.0.0.1:8090").rstrip("/")
PB_ADMIN_EMAIL = os.environ.get("PB_ADMIN_EMAIL", "")
PB_ADMIN_PASSWORD = os.environ.get("PB_ADMIN_PASSWORD", "")

IMAGE_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
]


# ── Field helper builders ───────────────────────────────────────────────────

def text(name: str, *, required: bool = False) -> dict:
    return {"name": name, "type": "text", "required": required, "options": {}}


def number(name: str, *, required: bool = False) -> dict:
    return {"name": name, "type": "number", "required": required, "options": {}}


def bool_field(name: str) -> dict:
    return {"name": name, "type": "bool", "options": {}}


def date(name: str) -> dict:
    return {"name": name, "type": "date", "options": {}}


def json_field(name: str) -> dict:
    return {"name": name, "type": "json", "options": {}}


def file(name: str, *, max_select: int = 1, mime_types: list[str] | None = None) -> dict:
    opts: dict = {"maxSelect": max_select, "mimeTypes": mime_types or [], "thumbs": []}
    return {"name": name, "type": "file", "options": opts}


def relation(name: str, collection_id: str, *, max_select: int | None = 1) -> dict:
    opts: dict = {"collectionId": collection_id, "cascadeDelete": False}
    if max_select is not None:
        opts["maxSelect"] = max_select
    return {"name": name, "type": "relation", "options": opts}


# ── Collections (no relations) ──────────────────────────────────────────────

BASE_COLLECTIONS: list[dict] = [
    {
        "name": "prompt_templates",
        "type": "base",
        "schema": [
            text("name", required=True),
            text("category"),
            text("description"),
            text("system_prompt", required=True),
            text("user_prompt", required=True),
            number("version"),
        ],
    },
    {
        "name": "benchmark_runs",
        "type": "base",
        "schema": [
            text("input_text", required=True),
            text("engine_name", required=True),
            text("model_name"),
            text("output_text"),
            text("error"),
            number("temperature"),
            number("max_tokens"),
            number("latency_ms"),
        ],
    },
    {
        "name": "chat_sessions",
        "type": "base",
        "schema": [
            text("title"),
            text("mode"),
        ],
    },
    {
        "name": "documents",
        "type": "base",
        "schema": [
            text("title"),
            json_field("content_json"),
            json_field("page_settings_json"),
            date("last_opened_at"),
            file("images", max_select=50, mime_types=IMAGE_MIME_TYPES),
        ],
    },
    {
        "name": "sheets",
        "type": "base",
        "schema": [
            text("title"),
            json_field("columns_json"),
            json_field("rows_json"),
            json_field("formulas_json"),
            json_field("sizes_json"),
            json_field("alignments_json"),
            json_field("formats_json"),
            date("last_opened_at"),
        ],
    },
    {
        "name": "canvases",
        "type": "base",
        "schema": [
            text("title"),
            json_field("canvas_json"),
        ],
    },
    {
        "name": "rf_canvases",
        "type": "base",
        "schema": [
            text("name"),
            json_field("data"),
            file("images", max_select=50, mime_types=IMAGE_MIME_TYPES),
        ],
    },
    {
        "name": "rss_feeds",
        "type": "base",
        "schema": [
            text("url", required=True),
            text("title"),
            text("description"),
            bool_field("is_active"),
            date("last_fetched_at"),
        ],
    },
    {
        "name": "pm_members",
        "type": "base",
        "schema": [
            text("name", required=True),
            text("email"),
            text("avatar_color"),
            text("initials"),
        ],
    },
    {
        "name": "pm_projects",
        "type": "base",
        "schema": [
            text("name", required=True),
            text("code"),
            text("description"),
            text("color"),
            text("icon"),
            text("status"),
        ],
    },
]


# ── Collections with relations (created after base collections exist) ───────
# Defined as functions because they need collection IDs resolved at runtime.

def build_relation_collections(ids: dict[str, str]) -> list[dict]:
    """Return collection definitions that depend on other collections.

    Args:
        ids: mapping of collection name -> PocketBase collection ID.
    """
    return [
        {
            "name": "chat_messages",
            "type": "base",
            "schema": [
                relation("session_id", ids["chat_sessions"]),
                text("role", required=True),
                text("content", required=True),
                text("metadata"),
            ],
        },
        {
            "name": "rss_articles",
            "type": "base",
            "schema": [
                relation("feed_id", ids["rss_feeds"]),
                text("guid", required=True),
                text("title"),
                text("summary"),
                text("url"),
                text("image_url"),
                date("published_at"),
            ],
        },
        {
            "name": "pm_sprints",
            "type": "base",
            "schema": [
                relation("project_id", ids["pm_projects"]),
                text("name", required=True),
                text("goal"),
                text("status"),
                date("start_date"),
                date("end_date"),
            ],
        },
        {
            # pm_tasks — created WITHOUT parent_id; self-relation added later.
            "name": "pm_tasks",
            "type": "base",
            "schema": [
                relation("project_id", ids["pm_projects"]),
                relation("sprint_id", ids["pm_sprints"]),
                relation("assignee_id", ids["pm_members"]),
                text("item_type"),
                text("title", required=True),
                text("description"),
                text("acceptance_criteria"),
                text("status"),
                text("priority"),
                text("severity"),
                number("project_task_id"),
                number("story_points"),
                number("position"),
                date("due_date"),
                date("resolved_date"),
                json_field("refs_json"),
                file("attachments", max_select=20),
            ],
        },
        {
            "name": "pm_task_labels",
            "type": "base",
            "schema": [
                relation("task_id", ids["pm_tasks"]),
                text("label", required=True),
            ],
        },
        {
            "name": "pm_activity",
            "type": "base",
            "schema": [
                relation("project_id", ids["pm_projects"]),
                relation("task_id", ids["pm_tasks"]),
                relation("member_id", ids["pm_members"]),
                text("action", required=True),
                text("detail"),
            ],
        },
    ]


# ── Migration runner ────────────────────────────────────────────────────────

async def get_existing_collections(client: httpx.AsyncClient, token: str) -> dict[str, str]:
    """Return {name: id} for all existing collections."""
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.get(f"{PB_URL}/api/collections", headers=headers, params={"perPage": 200})
    resp.raise_for_status()
    items = resp.json().get("items", [])
    return {c["name"]: c["id"] for c in items}


async def create_collection(
    client: httpx.AsyncClient,
    token: str,
    definition: dict,
    existing: dict[str, str],
) -> str | None:
    """Create a single collection. Returns its ID, or None if skipped."""
    name = definition["name"]
    if name in existing:
        print(f"  ⏭  {name} — already exists, skipping")
        return existing[name]

    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.post(f"{PB_URL}/api/collections", headers=headers, json=definition)
    resp.raise_for_status()
    col_id = resp.json()["id"]
    print(f"  ✓  {name} — created ({col_id})")
    return col_id


async def add_self_relation_to_pm_tasks(
    client: httpx.AsyncClient,
    token: str,
    existing: dict[str, str],
) -> None:
    """Patch pm_tasks to add the self-referential parent_id relation."""
    task_id = existing.get("pm_tasks")
    if not task_id:
        print("  ⚠  pm_tasks not found — cannot add parent_id relation")
        return

    # Fetch current schema
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.get(f"{PB_URL}/api/collections/{task_id}", headers=headers)
    resp.raise_for_status()
    schema = resp.json()["schema"]

    # Check if parent_id already exists
    if any(f["name"] == "parent_id" for f in schema):
        print("  ⏭  pm_tasks.parent_id — already exists, skipping")
        return

    # Append parent_id relation pointing to pm_tasks itself
    schema.append(relation("parent_id", task_id))
    resp = await client.patch(
        f"{PB_URL}/api/collections/{task_id}",
        headers=headers,
        json={"schema": schema},
    )
    resp.raise_for_status()
    print("  ✓  pm_tasks.parent_id — self-relation added")


async def run_migration() -> None:
    if not PB_ADMIN_EMAIL or not PB_ADMIN_PASSWORD:
        print("ERROR: PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD must be set.")
        sys.exit(1)

    async with httpx.AsyncClient(timeout=30) as client:
        # ── Authenticate ────────────────────────────────────────────────
        print("Authenticating as admin...")
        auth_resp = await client.post(
            f"{PB_URL}/api/admins/auth-with-password",
            json={"identity": PB_ADMIN_EMAIL, "password": PB_ADMIN_PASSWORD},
        )
        auth_resp.raise_for_status()
        token = auth_resp.json()["token"]
        print("  ✓  Authenticated\n")

        # ── Fetch existing collections (for idempotency) ───────────────
        existing = await get_existing_collections(client, token)

        # ── Phase 1: base collections (no relations) ───────────────────
        print("Creating base collections...")
        for defn in BASE_COLLECTIONS:
            col_id = await create_collection(client, token, defn, existing)
            if col_id:
                existing[defn["name"]] = col_id

        # ── Phase 2: collections with relations ────────────────────────
        print("\nCreating collections with relations...")
        for defn in build_relation_collections(existing):
            col_id = await create_collection(client, token, defn, existing)
            if col_id:
                existing[defn["name"]] = col_id

        # ── Phase 3: self-referential parent_id on pm_tasks ────────────
        print("\nAdding self-relation to pm_tasks...")
        await add_self_relation_to_pm_tasks(client, token, existing)

        print("\n✓  Migration complete — all collections ready.")


if __name__ == "__main__":
    asyncio.run(run_migration())
