import argparse
import json
import os
import shutil
import subprocess
from dataclasses import dataclass

import oracledb


DEFAULT_SITE = "MYDBPDB"


@dataclass(frozen=True)
class Issue:
    severity: str
    table: str
    column: str
    kind: str
    detail: str


def load_site(site_name: str) -> dict:
    config_path = os.path.expanduser("~/.oracle_db_config.json")
    with open(config_path, encoding="utf-8-sig") as f:
        config = json.load(f)
    return config["profiles"][site_name]


def connect(site_name: str):
    site = load_site(site_name)
    if site.get("sid"):
        dsn = f"{site['host']}:{site['port']}:{site['sid']}"
    else:
        dsn = f"{site['host']}:{site['port']}/{site['service_name']}"
    return oracledb.connect(user=site["user"], password=site["password"], dsn=dsn)


def fetch_rows(cur, sql: str, binds=None) -> list[dict]:
    cur.execute(sql, binds or {})
    names = [d[0] for d in cur.description]
    return [dict(zip(names, row)) for row in cur.fetchall()]


def export_typeorm_metadata() -> dict:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    backend_root = os.path.join(repo_root, "apps", "backend")
    script_path = os.path.join(repo_root, "tools", "export_typeorm_metadata.js")
    pnpm = shutil.which("pnpm") or shutil.which("pnpm.cmd")
    if pnpm is None:
        raise RuntimeError("pnpm executable was not found on PATH")
    result = subprocess.run(
        [pnpm, "exec", "node", script_path],
        cwd=backend_root,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def expected_oracle_type(column: dict) -> tuple[str, int | None, int | None, int | None]:
    typ = column["type"].upper()
    length = int(column["length"]) if column["length"] not in (None, "") else None
    precision = column["precision"]
    scale = column["scale"]

    if typ in ("STRING", "VARCHAR", "VARCHAR2"):
        return ("VARCHAR2", length or 255, None, None)
    if typ in ("TEXT", "CLOB"):
        return ("CLOB", None, None, None)
    if typ in ("NUMBER", "INT", "INTEGER"):
        return ("NUMBER", None, precision, scale if scale is not None else 0)
    if typ in ("FLOAT", "DOUBLE", "DECIMAL"):
        return ("NUMBER", None, precision, scale)
    if typ in ("DATE",):
        return ("DATE", None, None, None)
    if typ in ("TIMESTAMP", "DATETIME"):
        return ("TIMESTAMP(6)", None, None, None)
    if typ in ("BOOLEAN", "BOOL"):
        return ("NUMBER", None, 1, 0)
    return (typ, length, precision, scale)


def compatible_type(expected: tuple, actual: dict) -> bool:
    exp_type, exp_len, exp_precision, exp_scale = expected
    act_type = actual["DATA_TYPE"]
    if exp_type == act_type:
        pass
    elif exp_type == "VARCHAR2" and act_type == "CHAR" and exp_len == actual["DATA_LENGTH"]:
        return True
    elif exp_type == "UUID" and act_type == "VARCHAR2" and actual["DATA_LENGTH"] >= 36:
        return True
    elif exp_type == "TIMESTAMP(6)" and act_type.startswith("TIMESTAMP"):
        pass
    else:
        return False

    if exp_type in ("VARCHAR2", "CHAR", "NVARCHAR2") and exp_len is not None:
        return actual["DATA_LENGTH"] >= exp_len

    if exp_type == "NUMBER":
        act_precision = actual["DATA_PRECISION"]
        act_scale = actual["DATA_SCALE"]
        if exp_precision is None:
            return True
        if act_precision is None:
            return True
        return act_precision >= exp_precision and (act_scale or 0) == (exp_scale or 0)

    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare TypeORM entity metadata with Oracle USER schema.")
    parser.add_argument("--site", default=DEFAULT_SITE)
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--write-varchar-widen-migration")
    parser.add_argument("--write-not-null-migration")
    args = parser.parse_args()

    metadata = export_typeorm_metadata()
    entities = metadata["entities"]
    table_names = [entity["tableName"] for entity in entities]

    with connect(args.site) as conn:
        cur = conn.cursor()
        current_user = fetch_rows(cur, "SELECT USER AS USERNAME FROM DUAL")[0]["USERNAME"]
        db_columns = fetch_rows(
            cur,
            """
            SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, DATA_LENGTH, DATA_PRECISION, DATA_SCALE,
                   NULLABLE, DATA_DEFAULT, COLUMN_ID
            FROM USER_TAB_COLUMNS
            WHERE TABLE_NAME IN (SELECT COLUMN_VALUE FROM TABLE(sys.odcivarchar2list(%s)))
            ORDER BY TABLE_NAME, COLUMN_ID
            """ % ",".join(f"'{name}'" for name in table_names),
        )
        pk_rows = fetch_rows(
            cur,
            """
            SELECT cols.TABLE_NAME, cols.COLUMN_NAME, cols.POSITION
            FROM USER_CONSTRAINTS cons
            JOIN USER_CONS_COLUMNS cols ON cols.CONSTRAINT_NAME = cons.CONSTRAINT_NAME
            WHERE cons.CONSTRAINT_TYPE = 'P'
              AND cons.TABLE_NAME IN (SELECT COLUMN_VALUE FROM TABLE(sys.odcivarchar2list(%s)))
            ORDER BY cols.TABLE_NAME, cols.POSITION
            """ % ",".join(f"'{name}'" for name in table_names),
        )

    columns_by_table = {(row["TABLE_NAME"], row["COLUMN_NAME"]): row for row in db_columns}
    existing_tables = {row["TABLE_NAME"] for row in db_columns}
    pk_by_table: dict[str, list[str]] = {}
    for row in pk_rows:
        pk_by_table.setdefault(row["TABLE_NAME"], []).append(row["COLUMN_NAME"])

    issues: list[Issue] = []
    varchar_widen_sql: list[str] = []
    not_null_candidates: list[tuple[str, str]] = []
    for entity in entities:
        table = entity["tableName"]
        if table not in existing_tables:
            issues.append(Issue("error", table, "", "missing_table", "DB table is missing for TypeORM entity"))
            continue

        db_pk = pk_by_table.get(table, [])
        entity_pk = entity["primaryColumns"]
        if db_pk != entity_pk:
            issues.append(
                Issue("error", table, "", "primary_key_mismatch", f"entity={entity_pk}, db={db_pk}")
            )

        for column in entity["columns"]:
            col_name = column["columnName"]
            actual = columns_by_table.get((table, col_name))
            if actual is None:
                issues.append(Issue("error", table, col_name, "missing_column", "DB column is missing"))
                continue

            expected = expected_oracle_type(column)
            if not compatible_type(expected, actual):
                if (
                    expected[0] == "VARCHAR2"
                    and actual["DATA_TYPE"] == "VARCHAR2"
                    and expected[1] is not None
                    and actual["DATA_LENGTH"] < expected[1]
                ):
                    varchar_widen_sql.append(
                        f"ALTER TABLE {table} MODIFY ({col_name} VARCHAR2({expected[1]}));"
                    )
                issues.append(
                    Issue(
                        "warn",
                        table,
                        col_name,
                        "type_mismatch",
                        (
                            f"entity={expected}, db=({actual['DATA_TYPE']}, "
                            f"len={actual['DATA_LENGTH']}, precision={actual['DATA_PRECISION']}, "
                            f"scale={actual['DATA_SCALE']})"
                        ),
                    )
                )

            if column["primary"]:
                continue
            entity_nullable = bool(column["nullable"])
            db_nullable = actual["NULLABLE"] == "Y"
            if entity_nullable != db_nullable:
                if not entity_nullable and db_nullable:
                    not_null_candidates.append((table, col_name))
                issues.append(
                    Issue(
                        "warn",
                        table,
                        col_name,
                        "nullable_mismatch",
                        f"entity_nullable={entity_nullable}, db_nullable={db_nullable}",
                    )
                )

    db_tables = sorted(existing_tables)
    result = {
        "site": args.site,
        "schema": current_user,
        "entity_count": len(entities),
        "db_table_count_for_entities": len(db_tables),
        "issue_count": len(issues),
        "issues": [issue.__dict__ for issue in issues],
    }

    if args.write_varchar_widen_migration:
        with open(args.write_varchar_widen_migration, "w", encoding="utf-8", newline="\n") as f:
            f.write("BEGIN\n")
            for sql in sorted(set(varchar_widen_sql)):
                escaped = sql.rstrip(";").replace("'", "''")
                f.write(f"  EXECUTE IMMEDIATE '{escaped}';\n")
            f.write("END;\n/\n")

    if args.write_not_null_migration:
        safe_columns: list[tuple[str, str]] = []
        with connect(args.site) as conn:
            cur = conn.cursor()
            for table, col_name in not_null_candidates:
                cur.execute(f"SELECT COUNT(*) FROM {table} WHERE {col_name} IS NULL")
                null_count = cur.fetchone()[0]
                if null_count == 0:
                    safe_columns.append((table, col_name))
        with open(args.write_not_null_migration, "w", encoding="utf-8", newline="\n") as f:
            f.write("BEGIN\n")
            for table, col_name in safe_columns:
                f.write(f"  EXECUTE IMMEDIATE 'ALTER TABLE {table} MODIFY ({col_name} NOT NULL)';\n")
            f.write("END;\n/\n")

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"site={args.site} schema={current_user}")
        print(f"entities={len(entities)} db_tables_for_entities={len(db_tables)} issues={len(issues)}")
        for issue in issues:
            target = issue.table if not issue.column else f"{issue.table}.{issue.column}"
            print(f"{issue.severity.upper()} {issue.kind} {target}: {issue.detail}")

    return 1 if any(issue.severity == "error" for issue in issues) else 0


if __name__ == "__main__":
    raise SystemExit(main())
