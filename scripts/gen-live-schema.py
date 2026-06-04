#!/usr/bin/env python3
"""
gen-live-schema.py — 라이브 Oracle DB에서 실측한 스키마 DDL을 파일로 생성.

문서(create-hanes-schema.sql 등)는 stale해질 수 있으므로, 스키마 정본은 항상
실DB를 실측해서 만든다. 이 스크립트는 DBMS_METADATA로 현재 스키마의 모든
테이블/인덱스 DDL을 떠서 하나의 SQL 파일로 출력한다(재실행 가능).

사용법:
  python scripts/gen-live-schema.py [site] [out_path]
    site     : ~/.oracle_db_config.json 프로파일명 (기본 JSHANES)
    out_path : 출력 파일 경로 (기본 apps/backend/src/database/create-hanes-schema.sql)
"""
import json
import os
import sys
import datetime

import oracledb


def get_clob(v):
    return v.read() if hasattr(v, "read") else (v or "")


def main():
    site_name = sys.argv[1] if len(sys.argv) > 1 else "JSHANES"
    out_path = sys.argv[2] if len(sys.argv) > 2 else "apps/backend/src/database/create-hanes-schema.sql"

    with open(os.path.expanduser("~/.oracle_db_config.json")) as f:
        config = json.load(f)
    site = config["profiles"][site_name]

    conn = oracledb.connect(
        user=site["user"],
        password=site["password"],
        dsn=f"{site['host']}:{site['port']}/{site['service_name']}",
    )
    cur = conn.cursor()

    # DBMS_METADATA 출력 정리: 스토리지/테이블스페이스/세그먼트 속성 제거, 보기 좋게.
    cur.execute(
        """
        BEGIN
          DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM, 'SEGMENT_ATTRIBUTES', FALSE);
          DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM, 'STORAGE', FALSE);
          DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM, 'TABLESPACE', FALSE);
          DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM, 'PRETTY', TRUE);
          DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM, 'SQLTERMINATOR', TRUE);
        END;
        """
    )

    schema = site["user"].upper()
    prefix = f'"{schema}".'

    cur.execute("SELECT table_name FROM user_tables ORDER BY table_name")
    tables = [r[0] for r in cur.fetchall()]

    # 제약(PK/UK)이 만든 인덱스는 테이블 DDL에 이미 포함되므로 중복 출력 제외.
    cur.execute("SELECT index_name FROM user_constraints WHERE index_name IS NOT NULL")
    constraint_idx = {r[0] for r in cur.fetchall()}

    parts = []
    parts.append("-- ============================================================================")
    parts.append("-- HANES MES Oracle Schema — 라이브 DB 실측 자동 생성본")
    parts.append(f"-- 생성: scripts/gen-live-schema.py  |  site={site_name} (schema {schema})")
    parts.append(f"-- 생성일: {datetime.date.today().isoformat()}  |  테이블 {len(tables)}개")
    parts.append("-- 주의: 손으로 수정하지 말 것. 변경은 실DB에 반영 후 본 스크립트로 재생성.")
    parts.append("-- ============================================================================")
    parts.append("")

    failed = []
    for t in tables:
        try:
            ddl = get_clob(cur.callfunc("DBMS_METADATA.GET_DDL", oracledb.DB_TYPE_CLOB, ["TABLE", t]))
            parts.append(ddl.replace(prefix, "").strip())
            parts.append("")

            # 해당 테이블의 비-제약 인덱스
            cur.execute(
                "SELECT index_name FROM user_indexes WHERE table_name = :t AND generated = 'N' ORDER BY index_name",
                t=t,
            )
            idxs = [r[0] for r in cur.fetchall() if r[0] not in constraint_idx]
            for ix in idxs:
                idll = get_clob(cur.callfunc("DBMS_METADATA.GET_DDL", oracledb.DB_TYPE_CLOB, ["INDEX", ix]))
                parts.append(idll.replace(prefix, "").strip())
            if idxs:
                parts.append("")
        except Exception as e:  # noqa: BLE001
            failed.append({"table": t, "error": str(e)})
            parts.append(f"-- [생성 실패] {t}: {e}")
            parts.append("")

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(parts).rstrip() + "\n")

    print(json.dumps({"success": True, "out": out_path, "tables": len(tables), "failed": failed}, ensure_ascii=False))


if __name__ == "__main__":
    main()
