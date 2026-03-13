"""
@file hanes_backend.py
@description HTTP client for HANES MES Backend API.
    Wraps REST calls to the NestJS server running on localhost:3003.
    This is the 'real software backend' — the CLI is useless without it.
"""

import json
import urllib.request
import urllib.error
import urllib.parse
from typing import Any


DEFAULT_BASE_URL = "http://localhost:3003/api/v1"


class HanesAPIError(Exception):
    """Raised when the HANES API returns an error."""

    def __init__(self, status: int, message: str, data: Any = None):
        self.status = status
        self.message = message
        self.data = data
        super().__init__(f"[{status}] {message}")


class HanesBackend:
    """HTTP client for HANES MES Backend API.

    Uses only stdlib (urllib) to avoid extra dependencies.
    """

    def __init__(self, base_url: str = DEFAULT_BASE_URL,
                 token: str | None = None,
                 company: str | None = None,
                 plant: str | None = None,
                 timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.company = company
        self.plant = plant
        self.timeout = timeout

    def _headers(self) -> dict[str, str]:
        """Build request headers with auth and tenant info."""
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        if self.company:
            headers["X-Company"] = self.company
        if self.plant:
            headers["X-Plant"] = self.plant
        return headers

    def _request(self, method: str, path: str,
                 data: dict | None = None,
                 params: dict | None = None) -> dict:
        """Make an HTTP request to the API.

        Args:
            method: HTTP method (GET, POST, PUT, PATCH, DELETE).
            path: API path (e.g., '/auth/login').
            data: JSON body for POST/PUT/PATCH.
            params: Query parameters for GET.

        Returns:
            Parsed JSON response as dict.

        Raises:
            HanesAPIError: If the API returns an error.
            ConnectionError: If the backend is unreachable.
        """
        url = f"{self.base_url}{path}"

        if params:
            filtered = {k: v for k, v in params.items() if v is not None}
            if filtered:
                url += "?" + urllib.parse.urlencode(filtered)

        body = json.dumps(data).encode("utf-8") if data else None
        req = urllib.request.Request(
            url, data=body, headers=self._headers(), method=method
        )

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8", errors="replace")
            try:
                err_data = json.loads(raw)
                msg = err_data.get("message", raw)
            except json.JSONDecodeError:
                msg = raw
                err_data = None
            raise HanesAPIError(e.code, msg, err_data) from e
        except urllib.error.URLError as e:
            raise ConnectionError(
                f"Cannot connect to HANES MES backend at {self.base_url}\n"
                f"Start the server with: cd apps/backend && pnpm dev\n"
                f"Error: {e.reason}"
            ) from e

    def get(self, path: str, params: dict | None = None) -> dict:
        return self._request("GET", path, params=params)

    def post(self, path: str, data: dict | None = None) -> dict:
        return self._request("POST", path, data=data)

    def put(self, path: str, data: dict | None = None) -> dict:
        return self._request("PUT", path, data=data)

    def patch(self, path: str, data: dict | None = None) -> dict:
        return self._request("PATCH", path, data=data)

    def delete(self, path: str) -> dict:
        return self._request("DELETE", path)

    # ── Convenience: health check ────────────────────────────────────

    def ping(self) -> bool:
        """Check if the backend is reachable."""
        try:
            req = urllib.request.Request(self.base_url, method="GET")
            with urllib.request.urlopen(req, timeout=5):
                return True
        except Exception:
            return False

    # ── Auth ─────────────────────────────────────────────────────────

    def login(self, email: str, password: str) -> dict:
        result = self.post("/auth/login", {"email": email, "password": password})
        if "token" in result or "data" in result:
            token_data = result.get("data", result)
            if isinstance(token_data, dict):
                self.token = token_data.get("token", email)
            else:
                self.token = email
        return result

    def me(self) -> dict:
        return self.get("/auth/me")

    # ── Master ───────────────────────────────────────────────────────

    def list_parts(self, **params) -> dict:
        return self.get("/master/parts", params=params)

    def get_part(self, item_code: str) -> dict:
        return self.get(f"/master/parts/{urllib.parse.quote(item_code)}")

    def create_part(self, data: dict) -> dict:
        return self.post("/master/parts", data)

    def list_processes(self, **params) -> dict:
        return self.get("/master/processes", params=params)

    def list_boms(self, **params) -> dict:
        return self.get("/master/boms", params=params)

    def get_bom_hierarchy(self, parent_code: str, depth: int = 10) -> dict:
        return self.get(f"/master/boms/{urllib.parse.quote(parent_code)}/hierarchy",
                        params={"depth": depth})

    def list_routings(self, **params) -> dict:
        return self.get("/master/routings", params=params)

    def list_com_codes(self, **params) -> dict:
        return self.get("/master/com-codes", params=params)

    # ── Material ─────────────────────────────────────────────────────

    def list_arrivals(self, **params) -> dict:
        return self.get("/material/arrivals", params=params)

    def create_arrival(self, data: dict) -> dict:
        return self.post("/material/arrivals", data)

    def list_mat_lots(self, **params) -> dict:
        return self.get("/material/lots", params=params)

    def list_mat_stocks(self, **params) -> dict:
        return self.get("/material/stocks", params=params)

    def list_receivable(self, **params) -> dict:
        return self.get("/material/receiving/receivable", params=params)

    def create_receiving(self, data: dict) -> dict:
        return self.post("/material/receiving", data)

    # ── Production ───────────────────────────────────────────────────

    def list_job_orders(self, **params) -> dict:
        return self.get("/production/job-orders", params=params)

    def get_job_order(self, order_no: str) -> dict:
        return self.get(f"/production/job-orders/{urllib.parse.quote(order_no)}")

    def create_job_order(self, data: dict) -> dict:
        return self.post("/production/job-orders", data)

    def start_job_order(self, order_id: int) -> dict:
        return self.patch(f"/production/job-orders/{order_id}/start")

    def complete_job_order(self, order_id: int) -> dict:
        return self.patch(f"/production/job-orders/{order_id}/complete")

    def list_prod_results(self, **params) -> dict:
        return self.get("/production/prod-results", params=params)

    def create_prod_result(self, data: dict) -> dict:
        return self.post("/production/prod-results", data)

    # ── Quality ──────────────────────────────────────────────────────

    def list_reworks(self, **params) -> dict:
        return self.get("/quality/reworks", params=params)

    def create_rework(self, data: dict) -> dict:
        return self.post("/quality/reworks", data)

    def list_defect_logs(self, **params) -> dict:
        return self.get("/quality/defect-logs", params=params)

    def list_inspect_results(self, **params) -> dict:
        return self.get("/quality/inspect-results", params=params)

    # ── Inventory ────────────────────────────────────────────────────

    def list_product_stocks(self, **params) -> dict:
        return self.get("/inventory/product-stocks", params=params)

    def list_transactions(self, **params) -> dict:
        return self.get("/inventory/transactions", params=params)

    def list_warehouses(self, **params) -> dict:
        return self.get("/inventory/warehouses", params=params)

    # ── Equipment ────────────────────────────────────────────────────

    def list_equips(self, **params) -> dict:
        return self.get("/equipment/equips", params=params)

    # ── Shipping ─────────────────────────────────────────────────────

    def list_ship_orders(self, **params) -> dict:
        return self.get("/shipping/orders", params=params)

    # ── Dashboard ────────────────────────────────────────────────────

    def get_dashboard_kpi(self) -> dict:
        return self.get("/dashboard/kpi")

    def get_recent_productions(self) -> dict:
        return self.get("/dashboard/recent-productions")
