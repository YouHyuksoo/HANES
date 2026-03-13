"""
@file session.py
@description Session management for HANES MES CLI.
    Handles authentication state, company/plant context, and persistence.
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

from cli_anything.hanes.utils.hanes_backend import HanesBackend, DEFAULT_BASE_URL


DEFAULT_SESSION_DIR = Path.home() / ".cli-anything-hanes"
DEFAULT_SESSION_FILE = DEFAULT_SESSION_DIR / "session.json"


class Session:
    """Manages CLI session state including auth and tenant context."""

    def __init__(self, session_file: str | None = None):
        self.session_file = Path(session_file) if session_file else DEFAULT_SESSION_FILE
        self.base_url: str = DEFAULT_BASE_URL
        self.token: str | None = None
        self.company: str | None = None
        self.plant: str | None = None
        self.user_email: str | None = None
        self.last_login: str | None = None
        self._backend: HanesBackend | None = None

        self._load()

    def _load(self):
        """Load session from disk if it exists."""
        if self.session_file.exists():
            try:
                with open(self.session_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.base_url = data.get("base_url", DEFAULT_BASE_URL)
                self.token = data.get("token")
                self.company = data.get("company")
                self.plant = data.get("plant")
                self.user_email = data.get("user_email")
                self.last_login = data.get("last_login")
            except (json.JSONDecodeError, OSError):
                pass

    def save(self):
        """Persist session to disk."""
        self.session_file.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "base_url": self.base_url,
            "token": self.token,
            "company": self.company,
            "plant": self.plant,
            "user_email": self.user_email,
            "last_login": self.last_login,
        }
        with open(self.session_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def clear(self):
        """Clear session data (logout)."""
        self.token = None
        self.company = None
        self.plant = None
        self.user_email = None
        self.last_login = None
        self._backend = None
        if self.session_file.exists():
            self.session_file.unlink()

    @property
    def is_authenticated(self) -> bool:
        return self.token is not None

    @property
    def backend(self) -> HanesBackend:
        """Get or create the API backend client."""
        if self._backend is None:
            self._backend = HanesBackend(
                base_url=self.base_url,
                token=self.token,
                company=self.company,
                plant=self.plant,
            )
        return self._backend

    def login(self, email: str, password: str) -> dict:
        """Authenticate and store the session."""
        client = HanesBackend(base_url=self.base_url)
        result = client.login(email, password)

        data = result.get("data", result)
        self.token = data.get("token", email)
        self.user_email = email
        self.company = data.get("company")
        self.plant = data.get("plant")
        self.last_login = datetime.now().isoformat()
        self._backend = None
        self.save()
        return result

    def set_context(self, company: str | None = None, plant: str | None = None):
        """Update company/plant context."""
        if company is not None:
            self.company = company
        if plant is not None:
            self.plant = plant
        self._backend = None
        self.save()

    def to_dict(self) -> dict[str, Any]:
        """Serialize session for JSON output."""
        return {
            "authenticated": self.is_authenticated,
            "user_email": self.user_email,
            "company": self.company,
            "plant": self.plant,
            "base_url": self.base_url,
            "last_login": self.last_login,
        }
