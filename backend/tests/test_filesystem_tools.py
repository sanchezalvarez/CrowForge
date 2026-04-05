"""Tests for filesystem agent tools — path validation, read, write, list."""

import os
import sys
import json
import types
import pytest

# Mock heavy dependencies that agent_tools transitively imports
# so we don't need numpy, sentence-transformers, faiss, etc.
_fake_web = types.ModuleType("backend.ai.web_tools")
_fake_web.search_web = lambda *a, **kw: []
_fake_web.get_page_content = lambda *a, **kw: ""
sys.modules["backend.ai.web_tools"] = _fake_web

_fake_rag_mod = types.ModuleType("backend.ai.rag_engine")
class _FakeRAG:
    def index_directory(self, path): return {"error": "not available"}
    def query(self, q, top_k=5): return []
_fake_rag_mod.RAGEngine = _FakeRAG
sys.modules["backend.ai.rag_engine"] = _fake_rag_mod

from backend.ai.agent_tools import _resolve_path, MAX_READ_SIZE, build_tool_registry


# ── Path resolution ──────────────────────────────────────────────────────────

class TestResolvePath:
    def test_relative_path_resolves_from_base(self, tmp_path):
        result = _resolve_path("subdir/file.txt", str(tmp_path))
        assert result == os.path.realpath(os.path.join(str(tmp_path), "subdir/file.txt"))

    def test_empty_path_returns_base(self, tmp_path):
        result = _resolve_path("", str(tmp_path))
        assert result == os.path.realpath(str(tmp_path))

    def test_dot_path_returns_base(self, tmp_path):
        result = _resolve_path(".", str(tmp_path))
        assert result == os.path.realpath(str(tmp_path))

    def test_absolute_path_used_as_is(self, tmp_path):
        result = _resolve_path("/tmp/somefile.txt", str(tmp_path))
        assert result == os.path.realpath("/tmp/somefile.txt")

    def test_parent_traversal_allowed(self, tmp_path):
        result = _resolve_path("../other", str(tmp_path))
        assert isinstance(result, str)
        assert ".." not in result  # realpath resolves it


# ── Filesystem tool handlers (via registry) ──────────────────────────────────

class MockRepo:
    """Minimal mock repo for build_tool_registry."""
    def get_all(self): return []
    def get_by_id(self, _id): return None


def make_registry(workspace_dir: str):
    return build_tool_registry(MockRepo(), MockRepo(), workspace_dir=workspace_dir)


class TestListDirectory:
    pytestmark = pytest.mark.asyncio

    @pytest.mark.asyncio
    async def test_list_empty_dir(self, tmp_path):
        registry = make_registry(str(tmp_path))
        result = json.loads(await registry.call("list_directory", {"path": ""}))
        assert isinstance(result, list)
        assert len(result) == 0

    @pytest.mark.asyncio
    async def test_list_with_files(self, tmp_path):
        (tmp_path / "a.txt").write_text("hello")
        (tmp_path / "subdir").mkdir()
        registry = make_registry(str(tmp_path))
        result = json.loads(await registry.call("list_directory", {"path": ""}))
        names = {e["name"] for e in result}
        assert "a.txt" in names
        assert "subdir" in names
        file_entry = next(e for e in result if e["name"] == "a.txt")
        assert file_entry["type"] == "file"
        assert file_entry["size"] == 5
        dir_entry = next(e for e in result if e["name"] == "subdir")
        assert dir_entry["type"] == "dir"

    @pytest.mark.asyncio
    async def test_list_absolute_path(self, tmp_path):
        (tmp_path / "x.txt").write_text("hi")
        registry = make_registry(str(tmp_path))
        result = json.loads(await registry.call("list_directory", {"path": str(tmp_path)}))
        names = {e["name"] for e in result}
        assert "x.txt" in names


class TestReadFile:
    pytestmark = pytest.mark.asyncio

    @pytest.mark.asyncio
    async def test_read_existing_file(self, tmp_path):
        (tmp_path / "hello.txt").write_text("world")
        registry = make_registry(str(tmp_path))
        result = json.loads(await registry.call("read_file", {"path": "hello.txt"}))
        assert result["content"] == "world"
        assert result["size"] == 5

    @pytest.mark.asyncio
    async def test_read_missing_file(self, tmp_path):
        registry = make_registry(str(tmp_path))
        result = json.loads(await registry.call("read_file", {"path": "nope.txt"}))
        assert "error" in result
        assert "not found" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_read_too_large(self, tmp_path):
        big = tmp_path / "big.txt"
        big.write_bytes(b"x" * (MAX_READ_SIZE + 1))
        registry = make_registry(str(tmp_path))
        result = json.loads(await registry.call("read_file", {"path": "big.txt"}))
        assert "error" in result
        assert "too large" in result["error"].lower()


class TestWriteFile:
    pytestmark = pytest.mark.asyncio

    @pytest.mark.asyncio
    async def test_write_creates_file(self, tmp_path):
        registry = make_registry(str(tmp_path))
        result = json.loads(await registry.call("write_file", {"path": "new.txt", "content": "hello"}))
        assert result["ok"] is True
        assert (tmp_path / "new.txt").read_text() == "hello"

    @pytest.mark.asyncio
    async def test_write_creates_parent_dirs(self, tmp_path):
        registry = make_registry(str(tmp_path))
        result = json.loads(await registry.call("write_file", {"path": "a/b/c.txt", "content": "deep"}))
        assert result["ok"] is True
        assert (tmp_path / "a" / "b" / "c.txt").read_text() == "deep"

    @pytest.mark.asyncio
    async def test_write_with_absolute_path(self, tmp_path):
        target = str(tmp_path / "abs_test.txt")
        registry = make_registry(str(tmp_path))
        result = json.loads(await registry.call("write_file", {"path": target, "content": "abs"}))
        assert result["ok"] is True
        assert (tmp_path / "abs_test.txt").read_text() == "abs"


class TestAppendToFile:
    pytestmark = pytest.mark.asyncio

    @pytest.mark.asyncio
    async def test_append_to_existing(self, tmp_path):
        (tmp_path / "log.txt").write_text("line1\n")
        registry = make_registry(str(tmp_path))
        result = json.loads(await registry.call("append_to_file", {"path": "log.txt", "content": "line2\n"}))
        assert result["ok"] is True
        assert (tmp_path / "log.txt").read_text() == "line1\nline2\n"

    @pytest.mark.asyncio
    async def test_append_to_missing_file(self, tmp_path):
        registry = make_registry(str(tmp_path))
        result = json.loads(await registry.call("append_to_file", {"path": "nope.txt", "content": "data"}))
        assert "error" in result
        assert "not found" in result["error"].lower()
