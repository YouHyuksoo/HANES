import json
import os
from collections import defaultdict
from datetime import datetime

import oracledb


SITE = "JSHANES"
OUTPUT = os.path.join("docs", "reports", "db-schema-erd.md")


MODULE_RULES = [
    ("System/Auth", ("USERS", "ROLES", "MENU_", "PDA_", "COM_", "SYS_", "ACTIVITY_", "TRAINING_", "DEPARTMENT")),
    ("Master Data", ("ITEM_", "BOM_", "ROUTING_", "PROCESS_", "WORKER_", "VENDOR_", "PARTNER_", "COMPANY_", "WAREHOUSE_", "WORK_CALENDAR", "SHIFT_", "LABEL_", "IQC_PART_SPEC")),
    ("Material/Inventory", ("MAT_", "MATERIAL_", "PURCHASE_", "ARRIVAL", "RECEIV", "ISSUE", "INVENTORY", "STOCK", "LOT_", "PHYSICAL_INV")),
    ("Production", ("PROD_", "JOB_", "WORK_ORDER", "INPUT_", "DAILY_", "MONTHLY_", "WIP_", "BOX_", "PALLET_")),
    ("Quality", ("QUALITY_", "IQC_", "OQC_", "INSPECT", "DEFECT", "FAI_", "MSA_", "GAUGE_", "CALIBRATION_", "REWORK_", "CAPA_", "AUDIT_", "COMPLAINT", "PPAP", "CONTROL_PLAN", "CHANGE_")),
    ("Equipment/Interface", ("EQUIP_", "MOLD_", "CONSUMABLE_", "COMM_", "INTERFACE_", "INTER_", "SERIAL_")),
    ("Sales/Shipping", ("SALES_", "CUSTOMER_", "SHIP", "PALLET_", "PACK_", "OUTSOURC")),
    ("Trace/Logs", ("TRACE_", "LOG_", "ERROR_", "DB_BACKUP")),
]

SEMANTIC_PARENT = {
    "ITEM_CODE": "ITEM_MASTERS",
    "PARENT_ITEM_CODE": "ITEM_MASTERS",
    "CHILD_ITEM_CODE": "ITEM_MASTERS",
    "PROCESS_CODE": "PROCESS_MASTERS",
    "PROCESS_CD": "PROCESS_MASTERS",
    "EQUIP_CODE": "EQUIP_MASTERS",
    "WORKER_CODE": "WORKER_MASTERS",
    "WORKER_ID": "WORKER_MASTERS",
    "VENDOR_CODE": "VENDOR_MASTERS",
    "VENDOR_ID": "VENDOR_MASTERS",
    "PARTNER_CODE": "PARTNER_MASTERS",
    "PARTNER_ID": "PARTNER_MASTERS",
    "WAREHOUSE_CODE": "WAREHOUSES",
    "LOCATION_CODE": "WAREHOUSE_LOCATIONS",
    "GAUGE_CODE": "GAUGE_MASTERS",
    "MOLD_CODE": "MOLD_MASTERS",
    "CONSUMABLE_CODE": "CONSUMABLE_MASTERS",
    "PO_NO": "PURCHASE_ORDERS",
    "PO_ID": "PURCHASE_ORDERS",
    "PO_ITEM_ID": "PURCHASE_ORDER_ITEMS",
    "CAPA_ID": "CAPA_REQUESTS",
    "AUDIT_ID": "AUDIT_PLANS",
    "DEFECT_ID": "DEFECT_LOGS",
    "DEFECT_LOG_ID": "DEFECT_LOGS",
    "CALENDAR_ID": "WORK_CALENDARS",
}

CODE_GROUP_OVERRIDES = {
    ("PURCHASE_ORDERS", "USE_TYPE"): "PO_USE_TYPE",
    ("PURCHASE_ORDER_ITEMS", "LINE_STATUS"): "PO_LINE_STATUS",
    ("PURCHASE_ORDER_ITEMS", "USE_TYPE"): "PO_USE_TYPE",
}


def connect():
    config_path = os.path.expanduser("~/.oracle_db_config.json")
    with open(config_path, encoding="utf-8-sig") as f:
        config = json.load(f)
    site = config["profiles"][SITE]
    dsn = f"{site['host']}:{site['port']}/{site['service_name']}"
    return oracledb.connect(user=site["user"], password=site["password"], dsn=dsn)


def rows(cur, sql):
    cur.execute(sql)
    names = [d[0] for d in cur.description]
    return [dict(zip(names, row)) for row in cur.fetchall()]


def module_for(table_name):
    for module, prefixes in MODULE_RULES:
        if any(table_name.startswith(prefix) for prefix in prefixes):
            return module
    return "Other"


def type_label(col):
    typ = col["DATA_TYPE"]
    if typ in ("VARCHAR2", "NVARCHAR2", "CHAR", "NCHAR") and col["DATA_LENGTH"]:
        return f"{typ}({col['DATA_LENGTH']})"
    if typ == "NUMBER":
        precision = col["DATA_PRECISION"]
        scale = col["DATA_SCALE"]
        if precision is None:
            return "NUMBER"
        if scale is None or scale == 0:
            return f"NUMBER({precision})"
        return f"NUMBER({precision},{scale})"
    if typ in ("TIMESTAMP(6)", "DATE", "CLOB", "BLOB"):
        return typ
    return typ


def mermaid_type(col):
    return type_label(col).replace("(", "_").replace(")", "").replace(",", "_").replace(" ", "_")


def clean(value):
    if value is None:
        return ""
    return str(value).replace("\r", " ").replace("\n", " ").strip()


def cell(value):
    return clean(value).replace("|", "\\|")


def build_relationships(constraints, cons_cols):
    cols_by_constraint = defaultdict(list)
    for col in cons_cols:
        cols_by_constraint[col["CONSTRAINT_NAME"]].append(col)

    pk_by_constraint = {}
    for c in constraints:
        if c["CONSTRAINT_TYPE"] in ("P", "U"):
            pk_by_constraint[c["CONSTRAINT_NAME"]] = c

    relationships = []
    for c in constraints:
        if c["CONSTRAINT_TYPE"] != "R":
            continue
        parent = pk_by_constraint.get(c["R_CONSTRAINT_NAME"])
        if not parent:
            continue
        child_cols = [x["COLUMN_NAME"] for x in sorted(cols_by_constraint[c["CONSTRAINT_NAME"]], key=lambda x: x["POSITION"])]
        parent_cols = [x["COLUMN_NAME"] for x in sorted(cols_by_constraint[parent["CONSTRAINT_NAME"]], key=lambda x: x["POSITION"])]
        relationships.append(
            {
                "name": c["CONSTRAINT_NAME"],
                "child_table": c["TABLE_NAME"],
                "parent_table": parent["TABLE_NAME"],
                "child_cols": child_cols,
                "parent_cols": parent_cols,
                "delete_rule": c["DELETE_RULE"],
            }
        )
    return relationships


def build_inferred_relationships(tables, pk_cols, columns, enforced_keys):
    inferred = []
    table_set = set(tables)
    for col in columns:
        table = col["TABLE_NAME"]
        name = col["COLUMN_NAME"]
        if name in ("COMPANY", "PLANT", "PLANT_CD", "CREATED_BY", "UPDATED_BY"):
            continue
        candidates = []
        if name in SEMANTIC_PARENT and SEMANTIC_PARENT[name] in table_set:
            candidates.append(SEMANTIC_PARENT[name])
        base = None
        if name.endswith("_CODE"):
            base = name[:-5]
        elif name.endswith("_ID"):
            base = name[:-3]
        if base:
            for t in tables:
                if t == table:
                    continue
                if t.startswith(base + "_") or t == f"{base}_MASTERS" or t == f"{base}S":
                    candidates.append(t)
        for parent in sorted(set(candidates)):
            if parent == table:
                continue
            key = (table, parent, name)
            if key in enforced_keys:
                continue
            inferred.append({"child_table": table, "parent_table": parent, "child_col": name})
            break
    return inferred[:200]


def code_domain_map(code_rows):
    groups = defaultdict(list)
    for row in code_rows:
        groups[row["GROUP_CODE"]].append(row)
    return groups


def domain_for(col, check_by_col, code_groups):
    parts = []
    default = clean(col["DATA_DEFAULT"])
    if default:
        parts.append(f"기본값 `{default}`")
    checks = check_by_col.get((col["TABLE_NAME"], col["COLUMN_NAME"]), [])
    for expr in checks:
        if expr:
            parts.append(f"CHECK `{expr}`")
    code_key = CODE_GROUP_OVERRIDES.get((col["TABLE_NAME"], col["COLUMN_NAME"]), col["COLUMN_NAME"])
    if code_key == "STATUS" and (col["TABLE_NAME"], col["COLUMN_NAME"]) not in CODE_GROUP_OVERRIDES:
        code_key = None
    if code_key and code_key in code_groups:
        values = ", ".join(
            f"{r['DETAIL_CODE']}={clean(r['CODE_NAME'])}"
            for r in sorted(code_groups[code_key], key=lambda x: (x["SORT_ORDER"] or 0, x["DETAIL_CODE"]))[:20]
        )
        parts.append(f"COM_CODES.{code_key}: {values}")
    if col["COLUMN_NAME"] == "USE_YN":
        parts.append("관례값 Y/N")
    if col["COLUMN_NAME"] in ("COMPANY", "PLANT", "PLANT_CD"):
        parts.append("테넌트 범위 컬럼")
    return "<br>".join(parts)


def emit_mermaid(tables, columns_by_table, pk_cols, relationships):
    lines = ["```mermaid", "erDiagram"]
    for table in sorted(tables):
        lines.append(f"  {table} {{")
        key_cols = []
        for col in columns_by_table[table]:
            if col["COLUMN_NAME"] in pk_cols.get(table, []) or col["COLUMN_ID"] <= 12:
                key_cols.append(col)
        for col in key_cols[:18]:
            marker = " PK" if col["COLUMN_NAME"] in pk_cols.get(table, []) else ""
            nullable = "" if col["NULLABLE"] == "Y" else " NOT_NULL"
            lines.append(f"    {mermaid_type(col)} {col['COLUMN_NAME']}{marker}{nullable}")
        if len(columns_by_table[table]) > len(key_cols[:18]):
            lines.append("    string more_columns")
        lines.append("  }")
    for rel in relationships:
        if rel["child_table"] in tables and rel["parent_table"] in tables:
            label = ",".join(rel["child_cols"])
            lines.append(f"  {rel['child_table']} }}o--|| {rel['parent_table']} : \"{label}\"")
    lines.append("```")
    return "\n".join(lines)


def main():
    conn = connect()
    cur = conn.cursor()

    tables = rows(cur, """
        SELECT t.table_name, NVL(c.comments, '') comments, t.num_rows
        FROM user_tables t
        LEFT JOIN user_tab_comments c ON c.table_name = t.table_name
        WHERE t.nested = 'NO'
          AND t.table_name NOT LIKE 'BIN$%'
        ORDER BY t.table_name
    """)
    columns = rows(cur, """
        SELECT c.table_name, c.column_id, c.column_name, c.data_type,
               c.data_length, c.data_precision, c.data_scale,
               c.nullable, c.data_default, NVL(cc.comments, '') comments
        FROM user_tab_columns c
        LEFT JOIN user_col_comments cc
          ON cc.table_name = c.table_name AND cc.column_name = c.column_name
        WHERE c.table_name NOT LIKE 'BIN$%'
        ORDER BY c.table_name, c.column_id
    """)
    constraints = rows(cur, """
        SELECT constraint_name, constraint_type, table_name, r_constraint_name,
               delete_rule, search_condition_vc
        FROM user_constraints
        WHERE constraint_type IN ('P', 'U', 'R', 'C')
          AND table_name NOT LIKE 'BIN$%'
        ORDER BY table_name, constraint_type, constraint_name
    """)
    cons_cols = rows(cur, """
        SELECT constraint_name, table_name, column_name, position
        FROM user_cons_columns
        WHERE table_name NOT LIKE 'BIN$%'
        ORDER BY constraint_name, position
    """)
    code_rows = rows(cur, """
        SELECT group_code, detail_code, code_name, sort_order, use_yn
        FROM com_codes
        ORDER BY group_code, sort_order, detail_code
    """)
    conn.close()

    table_names = [t["TABLE_NAME"] for t in tables]
    table_meta = {t["TABLE_NAME"]: t for t in tables}
    columns_by_table = defaultdict(list)
    for col in columns:
        columns_by_table[col["TABLE_NAME"]].append(col)

    cols_by_constraint = defaultdict(list)
    for col in cons_cols:
        cols_by_constraint[col["CONSTRAINT_NAME"]].append(col)

    pk_cols = defaultdict(list)
    unique_cols = defaultdict(list)
    check_by_col = defaultdict(list)
    for c in constraints:
        ccols = [x["COLUMN_NAME"] for x in sorted(cols_by_constraint[c["CONSTRAINT_NAME"]], key=lambda x: x["POSITION"] or 0)]
        if c["CONSTRAINT_TYPE"] == "P":
            pk_cols[c["TABLE_NAME"]] = ccols
        elif c["CONSTRAINT_TYPE"] == "U":
            unique_cols[c["TABLE_NAME"]].append(ccols)
        elif c["CONSTRAINT_TYPE"] == "C":
            expr = clean(c["SEARCH_CONDITION_VC"])
            for col in ccols:
                if expr and not expr.endswith("IS NOT NULL"):
                    check_by_col[(c["TABLE_NAME"], col)].append(expr)

    relationships = build_relationships(constraints, cons_cols)
    enforced_keys = {
        (r["child_table"], r["parent_table"], col)
        for r in relationships
        for col in r["child_cols"]
    }
    inferred = build_inferred_relationships(table_names, pk_cols, columns, enforced_keys)
    code_groups = code_domain_map(code_rows)

    modules = defaultdict(list)
    for table in table_names:
        modules[module_for(table)].append(table)

    today = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = [
        "# HANES MES DB 스키마 및 ERD",
        "",
        f"- 작성일: {today}",
        f"- DB 사이트: `{SITE}`",
        "- 기준: Oracle data dictionary (`USER_TABLES`, `USER_TAB_COLUMNS`, `USER_CONSTRAINTS`, `USER_CONS_COLUMNS`, comments, `COM_CODES`)",
        "- 주의: DB에 물리 FK가 적은 구조이므로 `DB FK 관계`와 `추정 관계`를 분리했다.",
        "",
        "## 1. 요약",
        "",
        f"- 테이블 수: {len(table_names)}",
        f"- 컬럼 수: {len(columns)}",
        f"- PK 보유 테이블: {sum(1 for t in table_names if pk_cols.get(t))}",
        f"- DB FK 수: {len(relationships)}",
        f"- COM_CODES 그룹 수: {len(code_groups)}",
        "",
        "## 2. 모듈별 테이블",
        "",
    ]

    for module in sorted(modules):
        lines.append(f"### {module}")
        lines.append("")
        for table in sorted(modules[module]):
            comment = clean(table_meta[table]["COMMENTS"])
            pk = ", ".join(pk_cols.get(table, [])) or "-"
            lines.append(f"- `{table}`: {comment or '-'} / PK: `{pk}`")
        lines.append("")

    lines += [
        "## 3. DB FK ERD",
        "",
        emit_mermaid(table_names, columns_by_table, pk_cols, relationships),
        "",
        "### DB FK 목록",
        "",
        "| 자식 테이블 | 자식 컬럼 | 부모 테이블 | 부모 컬럼 | 삭제 규칙 |",
        "|---|---|---|---|---|",
    ]
    for r in relationships:
        lines.append(
            f"| `{r['child_table']}` | `{', '.join(r['child_cols'])}` | `{r['parent_table']}` | `{', '.join(r['parent_cols'])}` | `{r['delete_rule']}` |"
        )

    lines += [
        "",
        "## 4. 추정 관계",
        "",
        "물리 FK가 없지만 컬럼명과 PK 명칭으로 관계 가능성이 높은 항목이다. 실제 SQL/서비스 로직 검증 전에는 확정 관계로 보지 않는다.",
        "",
        "| 자식 테이블 | 컬럼 | 후보 부모 테이블 |",
        "|---|---|---|",
    ]
    for r in inferred:
        lines.append(f"| `{r['child_table']}` | `{r['child_col']}` | `{r['parent_table']}` |")

    lines += [
        "",
        "## 5. 모듈별 ERD",
        "",
    ]
    for module in sorted(modules):
        module_tables = sorted(modules[module])
        lines.append(f"### {module}")
        lines.append("")
        lines.append(emit_mermaid(module_tables, columns_by_table, pk_cols, relationships))
        lines.append("")

    lines += [
        "## 6. 컬럼 도메인 카탈로그",
        "",
        "표기: PK/FK/UK는 DB 제약 기준이다. 도메인은 기본값, CHECK, `COM_CODES` 매핑, 테넌트/사용여부 관례를 함께 표시한다.",
        "",
    ]

    fk_by_col = defaultdict(list)
    for r in relationships:
        for col in r["child_cols"]:
            fk_by_col[(r["child_table"], col)].append(f"{r['parent_table']}({', '.join(r['parent_cols'])})")

    for table in table_names:
        lines.append(f"### `{table}`")
        lines.append("")
        comment = clean(table_meta[table]["COMMENTS"])
        if comment:
            lines.append(f"- 설명: {comment}")
        lines.append(f"- PK: `{', '.join(pk_cols.get(table, [])) or '-'}`")
        if unique_cols.get(table):
            lines.append("- UK: " + "; ".join(f"`{', '.join(cols)}`" for cols in unique_cols[table]))
        lines.append("")
        lines.append("| 컬럼 | 타입 | NULL | 키 | 도메인/기본값/코드 | 코멘트 |")
        lines.append("|---|---|---|---|---|---|")
        for col in columns_by_table[table]:
            keys = []
            if col["COLUMN_NAME"] in pk_cols.get(table, []):
                keys.append("PK")
            if fk_by_col.get((table, col["COLUMN_NAME"])):
                keys.append("FK->" + "; ".join(fk_by_col[(table, col["COLUMN_NAME"])]))
            for uk in unique_cols.get(table, []):
                if col["COLUMN_NAME"] in uk:
                    keys.append("UK")
            lines.append(
                "| `{}` | `{}` | `{}` | {} | {} | {} |".format(
                    col["COLUMN_NAME"],
                    type_label(col),
                    col["NULLABLE"],
                    cell("<br>".join(keys)) or "",
                    cell(domain_for(col, check_by_col, code_groups)) or "",
                    cell(col["COMMENTS"]) or "",
                )
            )
        lines.append("")

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))
        f.write("\n")
    print(json.dumps({"output": OUTPUT, "tables": len(table_names), "columns": len(columns), "fk": len(relationships), "inferred": len(inferred)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
