"""AI 테이블 카탈로그 초기 md 생성 (DB의 테이블+코멘트 → docs 형식).
런타임 동기화는 POST /ai/catalog/sync 가 담당. 이 스크립트는 최초 시드용.
사용: python apps/backend/scripts/gen-ai-catalog.py [출력경로]
"""
import os, re, json, sys

import oracledb

CFG = os.path.expanduser("~/.oracle_db_config.json")
SITE = os.environ.get("AI_CATALOG_SITE", "JSHANES")

EXCLUDED = {
    "USERS", "USER_AUTHS", "ROLES", "ROLE_MENU_PERMISSIONS",
    "PDA_ROLES", "PDA_ROLE_MENU", "PDA_ROLE_MENUS",
}


def is_excluded(t: str) -> bool:
    u = t.upper()
    if u in EXCLUDED:
        return True
    if u.startswith("BIN$") or u.startswith("FLYWAY") or u.startswith("TYPEORM"):
        return True
    if u == "MIGRATIONS":
        return True
    if re.search(r"_(BAK|BACKUP|OLD|TMP|TEMP)(_?\d+)?$", u):
        return True
    return False


def main():
    with open(CFG) as f:
        site = json.load(f)["profiles"][SITE]
    conn = oracledb.connect(
        user=site["user"], password=site["password"],
        dsn=f"{site['host']}:{site['port']}/{site['service_name']}",
    )
    cur = conn.cursor()
    cur.execute(
        "SELECT TABLE_NAME, NVL(COMMENTS,'') FROM USER_TAB_COMMENTS "
        "WHERE TABLE_TYPE='TABLE' ORDER BY TABLE_NAME"
    )
    rows = [(name, cmt) for name, cmt in cur.fetchall() if not is_excluded(name)]
    conn.close()

    head = "\n".join([
        "# HANES MES — AI 테이블 카탈로그",
        "",
        "<!-- AI 질의(text-to-SQL) 시 주입되는 테이블 지식. 사람이 직접 편집할 수 있습니다. -->",
        "<!-- 형식: \"## 테이블명 — 설명\" / \"동의어: a, b\" / \"관계:\" 아래 \"- 컬럼 -> 대상테이블.컬럼\" -->",
        "<!-- \"DB와 동기화\" 시 누락 테이블이 자동 추가되며, 작성한 설명·관계는 보존됩니다. -->",
        "",
    ])
    body = "\n\n".join(
        f"## {name}{(' — ' + cmt) if cmt else ''}" for name, cmt in rows
    )
    out = f"{head}\n{body}\n"

    out_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(__file__), "..", "data", "ai-table-catalog.md"
    )
    out_path = os.path.abspath(out_path)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(out)
    print(f"wrote {len(rows)} tables -> {out_path}")


if __name__ == "__main__":
    main()
