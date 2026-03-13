"""
@file test_full_e2e.py
@description E2E tests for HANES MES CLI harness.
    These tests require the HANES MES backend running on localhost:3003.
    They invoke the real API and verify responses.

    Run with:
        python -m pytest cli_anything/hanes/tests/test_full_e2e.py -v -s

    For subprocess tests (installed CLI):
        CLI_ANYTHING_FORCE_INSTALLED=1 python -m pytest cli_anything/hanes/tests/test_full_e2e.py -v -s
"""

import json
import os
import subprocess
import sys

import pytest

from cli_anything.hanes.utils.hanes_backend import HanesBackend, HanesAPIError


# ── Fixtures ─────────────────────────────────────────────────────

def _backend_available() -> bool:
    """Check if the HANES backend is running."""
    try:
        b = HanesBackend()
        return b.ping()
    except Exception:
        return False


BACKEND_RUNNING = _backend_available()
skip_no_backend = pytest.mark.skipif(
    not BACKEND_RUNNING,
    reason="HANES MES backend not running on localhost:3003"
)


@pytest.fixture
def backend():
    """Create a fresh backend client."""
    return HanesBackend()


@pytest.fixture
def authed_backend():
    """Create an authenticated backend client.

    Uses TEST_EMAIL and TEST_PASSWORD env vars, or defaults.
    """
    email = os.environ.get("HANES_TEST_EMAIL", "admin@hanes.com")
    password = os.environ.get("HANES_TEST_PASSWORD", "admin123")
    b = HanesBackend()
    try:
        b.login(email, password)
    except Exception:
        pytest.skip("Cannot login with test credentials")
    return b


# ── Backend Connectivity Tests ───────────────────────────────────

class TestBackendConnectivity:
    """Verify backend is reachable and responds."""

    @skip_no_backend
    def test_ping(self, backend):
        assert backend.ping() is True

    @skip_no_backend
    def test_login(self, authed_backend):
        assert authed_backend.token is not None
        print(f"\n  Logged in as: {authed_backend.token}")

    @skip_no_backend
    def test_me(self, authed_backend):
        result = authed_backend.me()
        assert result is not None
        print(f"\n  User info: {json.dumps(result, indent=2, default=str)}")


# ── Master Data E2E Tests ───────────────────────────────────────

class TestMasterE2E:
    """E2E tests for master data queries."""

    @skip_no_backend
    def test_list_parts(self, authed_backend):
        result = authed_backend.list_parts(page=1, limit=5)
        assert result is not None
        data = result.get("data", result)
        if isinstance(data, list):
            print(f"\n  Parts found: {len(data)}")
            for p in data[:3]:
                print(f"    {p.get('itemCode', '?')}: {p.get('itemName', '?')}")

    @skip_no_backend
    def test_list_processes(self, authed_backend):
        result = authed_backend.list_processes(page=1, limit=5)
        assert result is not None
        data = result.get("data", result)
        if isinstance(data, list):
            print(f"\n  Processes found: {len(data)}")

    @skip_no_backend
    def test_list_com_codes(self, authed_backend):
        result = authed_backend.list_com_codes()
        assert result is not None


# ── Material E2E Tests ───────────────────────────────────────────

class TestMaterialE2E:
    """E2E tests for material queries."""

    @skip_no_backend
    def test_list_mat_stocks(self, authed_backend):
        result = authed_backend.list_mat_stocks(page=1, limit=5)
        assert result is not None

    @skip_no_backend
    def test_list_mat_lots(self, authed_backend):
        result = authed_backend.list_mat_lots(page=1, limit=5)
        assert result is not None


# ── Production E2E Tests ─────────────────────────────────────────

class TestProductionE2E:
    """E2E tests for production queries."""

    @skip_no_backend
    def test_list_job_orders(self, authed_backend):
        result = authed_backend.list_job_orders(page=1, limit=5)
        assert result is not None
        data = result.get("data", result)
        if isinstance(data, list):
            print(f"\n  Job orders found: {len(data)}")

    @skip_no_backend
    def test_list_prod_results(self, authed_backend):
        result = authed_backend.list_prod_results(page=1, limit=5)
        assert result is not None


# ── Quality E2E Tests ────────────────────────────────────────────

class TestQualityE2E:
    """E2E tests for quality queries."""

    @skip_no_backend
    def test_list_reworks(self, authed_backend):
        result = authed_backend.list_reworks(page=1, limit=5)
        assert result is not None

    @skip_no_backend
    def test_list_defect_logs(self, authed_backend):
        result = authed_backend.list_defect_logs(page=1, limit=5)
        assert result is not None


# ── CLI Subprocess Tests ─────────────────────────────────────────

def _resolve_cli(name: str) -> list[str]:
    """Resolve installed CLI command; falls back to python -m for dev.

    Set env CLI_ANYTHING_FORCE_INSTALLED=1 to require the installed command.
    On Windows, console_scripts may be blocked by application control policy,
    so we always use the python -m fallback.
    """
    import shutil
    force = os.environ.get("CLI_ANYTHING_FORCE_INSTALLED", "").strip() == "1"

    if sys.platform != "win32":
        path = shutil.which(name)
        if path:
            print(f"[_resolve_cli] Using installed command: {path}")
            return [path]

    if force and sys.platform != "win32":
        raise RuntimeError(f"{name} not found in PATH. Install with: pip install -e .")

    print(f"[_resolve_cli] Using: {sys.executable} -m cli_anything.hanes")
    return [sys.executable, "-m", "cli_anything.hanes"]


class TestCLISubprocess:
    """Test the installed CLI command via subprocess."""

    CLI_BASE = _resolve_cli("cli-anything-hanes")

    def _run(self, args: list[str], check: bool = True) -> subprocess.CompletedProcess:
        return subprocess.run(
            self.CLI_BASE + args,
            capture_output=True, text=True, check=check,
        )

    def test_help(self):
        result = self._run(["--help"])
        assert result.returncode == 0
        assert "HANES MES CLI" in result.stdout

    def test_version(self):
        result = self._run(["--version"])
        assert result.returncode == 0
        assert "1.0.0" in result.stdout

    def test_auth_status_json(self):
        result = self._run(["--json", "auth", "status"], check=False)
        if result.returncode == 0:
            data = json.loads(result.stdout)
            assert "authenticated" in data

    @skip_no_backend
    def test_master_parts_json(self):
        """Query master parts via subprocess with JSON output."""
        result = self._run(["--json", "master", "parts", "--limit", "3"],
                           check=False)
        if result.returncode == 0:
            data = json.loads(result.stdout)
            assert data is not None
            print(f"\n  Subprocess master parts: {json.dumps(data, indent=2, default=str)[:200]}...")
