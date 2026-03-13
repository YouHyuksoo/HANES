"""
@file test_core.py
@description Unit tests for HANES MES CLI core modules.
    Tests use synthetic data — no external dependencies required.
"""

import json
import os
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from cli_anything.hanes.core.session import Session
from cli_anything.hanes.utils.hanes_backend import (
    HanesBackend, HanesAPIError, DEFAULT_BASE_URL,
)


# ── Session Tests ────────────────────────────────────────────────


class TestSession:
    """Unit tests for Session class."""

    def test_session_defaults(self, tmp_path):
        """Fresh session has sensible defaults."""
        sf = tmp_path / "session.json"
        s = Session(session_file=str(sf))
        assert s.base_url == DEFAULT_BASE_URL
        assert s.token is None
        assert s.company is None
        assert s.plant is None
        assert s.user_email is None
        assert not s.is_authenticated

    def test_session_save_load(self, tmp_path):
        """Session persists to disk and reloads."""
        sf = tmp_path / "session.json"
        s1 = Session(session_file=str(sf))
        s1.token = "test@example.com"
        s1.company = "HQ"
        s1.plant = "PLANT-01"
        s1.user_email = "test@example.com"
        s1.save()

        s2 = Session(session_file=str(sf))
        assert s2.token == "test@example.com"
        assert s2.company == "HQ"
        assert s2.plant == "PLANT-01"
        assert s2.user_email == "test@example.com"

    def test_session_clear(self, tmp_path):
        """Clear removes session data and file."""
        sf = tmp_path / "session.json"
        s = Session(session_file=str(sf))
        s.token = "test@example.com"
        s.save()
        assert sf.exists()

        s.clear()
        assert s.token is None
        assert not s.is_authenticated
        assert not sf.exists()

    def test_session_is_authenticated(self, tmp_path):
        """Auth check is based on token presence."""
        sf = tmp_path / "session.json"
        s = Session(session_file=str(sf))
        assert not s.is_authenticated
        s.token = "user@test.com"
        assert s.is_authenticated

    def test_session_set_context(self, tmp_path):
        """set_context updates company/plant and saves."""
        sf = tmp_path / "session.json"
        s = Session(session_file=str(sf))
        s.set_context(company="ACME", plant="P1")
        assert s.company == "ACME"
        assert s.plant == "P1"
        assert sf.exists()

    def test_session_set_context_partial(self, tmp_path):
        """set_context with only one param preserves the other."""
        sf = tmp_path / "session.json"
        s = Session(session_file=str(sf))
        s.company = "OLD"
        s.plant = "P0"
        s.set_context(company="NEW")
        assert s.company == "NEW"
        assert s.plant == "P0"

    def test_session_to_dict(self, tmp_path):
        """to_dict returns complete serialization."""
        sf = tmp_path / "session.json"
        s = Session(session_file=str(sf))
        s.token = "user@test.com"
        s.user_email = "user@test.com"
        s.company = "HQ"
        s.plant = "P1"
        d = s.to_dict()
        assert d["authenticated"] is True
        assert d["user_email"] == "user@test.com"
        assert d["company"] == "HQ"
        assert d["plant"] == "P1"
        assert "base_url" in d

    def test_session_invalid_file(self, tmp_path):
        """Corrupt session file doesn't crash."""
        sf = tmp_path / "session.json"
        sf.write_text("INVALID JSON{{{{", encoding="utf-8")
        s = Session(session_file=str(sf))
        assert s.token is None

    def test_session_backend_property(self, tmp_path):
        """Backend property creates HanesBackend lazily."""
        sf = tmp_path / "session.json"
        s = Session(session_file=str(sf))
        s.token = "admin@test.com"
        s.company = "HQ"
        b = s.backend
        assert isinstance(b, HanesBackend)
        assert b.token == "admin@test.com"
        assert b.company == "HQ"


# ── Backend Tests ────────────────────────────────────────────────


class TestHanesBackend:
    """Unit tests for HanesBackend HTTP client."""

    def test_headers_no_auth(self):
        """Headers without auth token."""
        b = HanesBackend()
        h = b._headers()
        assert h["Content-Type"] == "application/json"
        assert "Authorization" not in h

    def test_headers_with_auth(self):
        """Headers include Bearer token when set."""
        b = HanesBackend(token="admin@test.com")
        h = b._headers()
        assert h["Authorization"] == "Bearer admin@test.com"

    def test_headers_with_tenant(self):
        """Headers include tenant info when set."""
        b = HanesBackend(token="x", company="HQ", plant="P1")
        h = b._headers()
        assert h["X-Company"] == "HQ"
        assert h["X-Plant"] == "P1"

    def test_headers_no_tenant(self):
        """Headers omit tenant when not set."""
        b = HanesBackend()
        h = b._headers()
        assert "X-Company" not in h
        assert "X-Plant" not in h

    def test_default_base_url(self):
        """Default base URL is localhost:3003."""
        b = HanesBackend()
        assert "3003" in b.base_url
        assert "/api/v1" in b.base_url

    def test_custom_base_url(self):
        """Custom base URL is respected."""
        b = HanesBackend(base_url="http://192.168.1.100:3003/api/v1")
        assert "192.168.1.100" in b.base_url

    def test_base_url_strip_trailing_slash(self):
        """Trailing slash is stripped from base URL."""
        b = HanesBackend(base_url="http://localhost:3003/api/v1/")
        assert not b.base_url.endswith("/")

    def test_api_error_class(self):
        """HanesAPIError carries status and message."""
        err = HanesAPIError(404, "Not found", {"detail": "x"})
        assert err.status == 404
        assert "Not found" in str(err)
        assert err.data == {"detail": "x"}

    def test_ping_unreachable(self):
        """Ping returns False when backend is unreachable."""
        b = HanesBackend(base_url="http://127.0.0.1:19999/api/v1")
        assert b.ping() is False


# ── CLI Command Registration Tests ──────────────────────────────

class TestCLICommands:
    """Verify all command groups are properly registered."""

    def test_cli_group_exists(self):
        from cli_anything.hanes.hanes_cli import cli
        assert cli is not None

    def test_auth_group_exists(self):
        from cli_anything.hanes.hanes_cli import auth_group
        cmds = [c.name for c in auth_group.commands.values()]
        assert "login" in cmds
        assert "me" in cmds
        assert "logout" in cmds
        assert "status" in cmds

    def test_master_group_exists(self):
        from cli_anything.hanes.core.master import master_group
        cmds = [c.name for c in master_group.commands.values()]
        assert "parts" in cmds
        assert "processes" in cmds
        assert "boms" in cmds
        assert "routings" in cmds
        assert "com-codes" in cmds

    def test_material_group_exists(self):
        from cli_anything.hanes.core.material import material_group
        cmds = [c.name for c in material_group.commands.values()]
        assert "arrivals" in cmds
        assert "lots" in cmds
        assert "stocks" in cmds

    def test_production_group_exists(self):
        from cli_anything.hanes.core.production import production_group
        cmds = [c.name for c in production_group.commands.values()]
        assert "orders" in cmds
        assert "results" in cmds
        assert "start" in cmds
        assert "complete" in cmds

    def test_quality_group_exists(self):
        from cli_anything.hanes.core.quality import quality_group
        cmds = [c.name for c in quality_group.commands.values()]
        assert "reworks" in cmds
        assert "defects" in cmds
        assert "inspections" in cmds

    def test_inventory_group_exists(self):
        from cli_anything.hanes.core.inventory import inventory_group
        cmds = [c.name for c in inventory_group.commands.values()]
        assert "product-stocks" in cmds
        assert "transactions" in cmds
        assert "warehouses" in cmds


# ── CLI Click Runner Tests ───────────────────────────────────────

class TestCLIRunner:
    """Test CLI commands via Click's test runner (no real API calls)."""

    def test_cli_help(self):
        from click.testing import CliRunner
        from cli_anything.hanes.hanes_cli import cli
        runner = CliRunner()
        result = runner.invoke(cli, ["--help"])
        assert result.exit_code == 0
        assert "HANES MES CLI" in result.output

    def test_cli_version(self):
        from click.testing import CliRunner
        from cli_anything.hanes.hanes_cli import cli
        runner = CliRunner()
        result = runner.invoke(cli, ["--version"])
        assert result.exit_code == 0
        assert "1.0.0" in result.output

    def test_auth_status_no_session(self, tmp_path):
        from click.testing import CliRunner
        from cli_anything.hanes.hanes_cli import cli
        runner = CliRunner()
        sf = str(tmp_path / "session.json")
        result = runner.invoke(cli, ["--session-file", sf, "auth", "status"])
        assert result.exit_code == 0
        assert "No" in result.output or "authenticated" in result.output.lower()

    def test_auth_logout(self, tmp_path):
        from click.testing import CliRunner
        from cli_anything.hanes.hanes_cli import cli
        runner = CliRunner()
        sf = str(tmp_path / "session.json")
        result = runner.invoke(cli, ["--session-file", sf, "auth", "logout"])
        assert result.exit_code == 0

    def test_json_mode_auth_status(self, tmp_path):
        from click.testing import CliRunner
        from cli_anything.hanes.hanes_cli import cli
        runner = CliRunner()
        sf = str(tmp_path / "session.json")
        result = runner.invoke(cli, ["--json", "--session-file", sf,
                                      "auth", "status"])
        assert result.exit_code == 0
        data = json.loads(result.output)
        assert "authenticated" in data
        assert data["authenticated"] is False
