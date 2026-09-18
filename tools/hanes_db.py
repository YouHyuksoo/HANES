"""HANES DB 접속 단일 출처 (python).

접속 값은 apps/backend/.env(.env.local 우선) 하나만 읽는다.
백엔드 런타임(database/oracle-env.ts)과 같은 환경변수를 사용하므로,
DB를 바꾸려면 .env 만 수정하면 앱·스크립트·ERD 생성기가 함께 따라간다.

사용법:
    import sys, os
    sys.path.insert(0, os.path.join(<repo_root>, "tools"))
    from hanes_db import connect, describe_target

    with connect() as conn:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM DUAL")

주의: 과거 스크립트들이 쓰던 ~/.oracle_db_config.json 프로파일(--site JSHANES)은
사용자 홈에 있어 배포 서버에 없다. 새 스크립트는 이 모듈을 사용한다.
"""

from __future__ import annotations

import os
from typing import Dict, Optional

import oracledb

__all__ = ["repo_root", "load_env", "build_dsn", "connect", "describe_target"]


def repo_root() -> str:
    """tools/ 의 부모 = 저장소 루트."""
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _parse_env_file(path: str, into: Dict[str, str]) -> None:
    """단순 KEY=VALUE 파서. 이미 채워진 키는 덮어쓰지 않는다(먼저 읽은 파일 우선)."""
    if not os.path.isfile(path):
        return
    with open(path, encoding="utf-8-sig") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in into:
                into[key] = value


def load_env(env_dir: Optional[str] = None) -> Dict[str, str]:
    """apps/backend 의 .env.local → .env 순으로 읽는다. 실제 프로세스 환경변수가 최우선."""
    base = env_dir or os.path.join(repo_root(), "apps", "backend")
    values: Dict[str, str] = {}
    for key in (
        "ORACLE_HOST",
        "ORACLE_PORT",
        "ORACLE_USER",
        "ORACLE_PASSWORD",
        "ORACLE_SID",
        "ORACLE_SERVICE_NAME",
    ):
        current = os.environ.get(key)
        if current:
            values[key] = current
    _parse_env_file(os.path.join(base, ".env.local"), values)
    _parse_env_file(os.path.join(base, ".env"), values)

    missing = [k for k in ("ORACLE_HOST", "ORACLE_USER", "ORACLE_PASSWORD") if not values.get(k)]
    if missing:
        raise RuntimeError(
            f"[hanes_db] {', '.join(missing)} 가 비어 있습니다. apps/backend/.env 를 확인하세요."
        )
    if not values.get("ORACLE_SID") and not values.get("ORACLE_SERVICE_NAME"):
        raise RuntimeError(
            "[hanes_db] ORACLE_SID 또는 ORACLE_SERVICE_NAME 중 하나는 필요합니다. apps/backend/.env 를 확인하세요."
        )
    return values


def build_dsn(values: Optional[Dict[str, str]] = None) -> str:
    """SID 가 있으면 TNS Descriptor, 없으면 EZConnect (oracle-env.ts 와 동일 규칙)."""
    v = values or load_env()
    host = v["ORACLE_HOST"]
    port = v.get("ORACLE_PORT") or "1521"
    sid = v.get("ORACLE_SID")
    if sid:
        return (
            f"(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST={host})(PORT={port}))"
            f"(CONNECT_DATA=(SID={sid})))"
        )
    return f"{host}:{port}/{v['ORACLE_SERVICE_NAME']}"


def connect(values: Optional[Dict[str, str]] = None) -> oracledb.Connection:
    v = values or load_env()
    return oracledb.connect(user=v["ORACLE_USER"], password=v["ORACLE_PASSWORD"], dsn=build_dsn(v))


def describe_target(values: Optional[Dict[str, str]] = None) -> str:
    """로그·문서용 요약 (비밀번호 제외)."""
    v = values or load_env()
    target = (
        f"SID={v['ORACLE_SID']}" if v.get("ORACLE_SID") else f"SERVICE={v['ORACLE_SERVICE_NAME']}"
    )
    return f"{v['ORACLE_HOST']}:{v.get('ORACLE_PORT') or '1521'} {target} USER={v['ORACLE_USER']}"
