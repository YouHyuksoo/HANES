"""
@file compare_schema.py
@description Oracle DB 스키마와 TypeORM 엔티티 정의를 비교하여 불일치를 찾는 스크립트.

Usage: python scripts/compare_schema.py <db_schema_json_path>

초보자 가이드:
1. DB 스키마 JSON 파일을 읽어 테이블/컬럼 정보를 파싱
2. TypeORM 엔티티 .ts 파일들을 읽어 테이블명/컬럼명을 추출
3. 양쪽을 비교하여 불일치(누락/초과/미존재 테이블)를 출력
"""
import json
import re
import sys
import glob
import os

# ── 무시할 컬럼 목록 (TypeORM 자동 관리 등) ──
IGNORE_COLUMNS = set()

ENTITIES_DIR = os.path.join(
    os.path.dirname(__file__), '..', 'apps', 'backend', 'src', 'entities'
)


def load_db_schema(json_path: str) -> dict[str, set[str]]:
    """DB 스키마 JSON을 읽어 { TABLE_NAME: {COL1, COL2, ...} } 형태로 반환."""
    with open(json_path, 'r', encoding='utf-8') as f:
        raw = json.load(f)

    rows = raw.get('data', raw) if isinstance(raw, dict) else raw
    schema: dict[str, set[str]] = {}
    for row in rows:
        table = row['TABLE_NAME']
        col = row['COLUMN_NAME']
        schema.setdefault(table, set()).add(col)
    return schema


def parse_entity_file(filepath: str) -> tuple[str | None, set[str]]:
    """
    엔티티 .ts 파일을 파싱하여 (TABLE_NAME, {COL_NAME, ...})을 반환.
    테이블명이 없으면 (None, set())을 반환.
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # ── 테이블명 추출 ──
    # @Entity({ name: 'TABLE_NAME' }) or @Entity({name:'TABLE_NAME'})
    table_match = re.search(
        r"@Entity\s*\(\s*\{[^}]*name\s*:\s*['\"](\w+)['\"]",
        content, re.DOTALL
    )
    if not table_match:
        return None, set()
    table_name = table_match.group(1)

    # ── 컬럼명 추출 ──
    columns: set[str] = set()

    # 데코레이터 패턴들:
    # @Column({ name: 'COL' ... })
    # @PrimaryColumn({ name: 'COL' ... })
    # @CreateDateColumn({ name: 'COL' })
    # @UpdateDateColumn({ name: 'COL' })
    # @DeleteDateColumn({ name: 'COL' })
    # @JoinColumn은 관계 컬럼 — 이미 @Column/@PrimaryColumn으로 정의된 경우가 많으므로
    #   별도 물리 컬럼이 있을 수 있음. @ManyToOne + @JoinColumn만 있고 @Column이 없는 경우 처리.

    decorator_pattern = re.compile(
        r'@(?:Primary)?Column\s*\(\s*\{[^}]*?name\s*:\s*[\'"](\w+)[\'"]',
        re.DOTALL
    )
    for m in decorator_pattern.finditer(content):
        columns.add(m.group(1))

    # CreateDateColumn, UpdateDateColumn, DeleteDateColumn
    date_col_pattern = re.compile(
        r'@(?:Create|Update|Delete)DateColumn\s*\(\s*\{[^}]*?name\s*:\s*[\'"](\w+)[\'"]',
        re.DOTALL
    )
    for m in date_col_pattern.finditer(content):
        columns.add(m.group(1))

    # JoinColumn — only if the same column name is NOT already captured
    # This handles cases where @ManyToOne + @JoinColumn define a FK column
    # without a separate @Column decorator
    join_col_pattern = re.compile(
        r'@JoinColumn\s*\(\s*\{[^}]*?name\s*:\s*[\'"](\w+)[\'"]',
        re.DOTALL
    )
    join_columns: set[str] = set()
    for m in join_col_pattern.finditer(content):
        join_columns.add(m.group(1))

    # Add JoinColumn names only if not already present from @Column/@PrimaryColumn
    # (JoinColumn on its own can create a physical column)
    # But we need to be careful: if a property has both @PrimaryColumn and @JoinColumn
    # with the same name, we already have it. Only add truly new ones.
    # Actually, let's check if there's a corresponding @Column for the same property.
    # Simpler approach: just add all JoinColumn names — duplicates are handled by set.
    columns.update(join_columns)

    return table_name, columns


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/compare_schema.py <db_schema_json_path>")
        sys.exit(1)

    json_path = sys.argv[1]
    db_schema = load_db_schema(json_path)

    # ── 엔티티 파싱 ──
    entity_dir = os.path.normpath(ENTITIES_DIR)
    entity_files = glob.glob(os.path.join(entity_dir, '*.entity.ts'))

    entity_schema: dict[str, dict] = {}  # table -> { columns, file }
    for fpath in sorted(entity_files):
        table, cols = parse_entity_file(fpath)
        if table:
            entity_schema[table] = {
                'columns': cols,
                'file': os.path.basename(fpath),
            }

    # ── 비교 ──
    mismatch_count = 0

    # 1) 엔티티에 있는 테이블 기준으로 비교
    for table in sorted(entity_schema.keys()):
        info = entity_schema[table]
        entity_cols = info['columns'] - IGNORE_COLUMNS

        if table not in db_schema:
            mismatch_count += 1
            print(f"\n{'='*70}")
            print(f"TABLE: {table}  (entity: {info['file']})")
            print(f"  ⚠ TABLE NOT FOUND IN DB")
            print(f"  Entity columns: {sorted(entity_cols)}")
            continue

        db_cols = db_schema[table] - IGNORE_COLUMNS
        missing_in_entity = db_cols - entity_cols
        extra_in_entity = entity_cols - db_cols

        if missing_in_entity or extra_in_entity:
            mismatch_count += 1
            print(f"\n{'='*70}")
            print(f"TABLE: {table}  (entity: {info['file']})")
            if missing_in_entity:
                print(f"  In DB but NOT in entity ({len(missing_in_entity)}):")
                for c in sorted(missing_in_entity):
                    print(f"    - {c}")
            if extra_in_entity:
                print(f"  In entity but NOT in DB ({len(extra_in_entity)}):")
                for c in sorted(extra_in_entity):
                    print(f"    + {c}")

    # 2) DB에 있지만 엔티티가 없는 테이블
    db_only_tables = set(db_schema.keys()) - set(entity_schema.keys())
    if db_only_tables:
        print(f"\n{'='*70}")
        print(f"TABLES IN DB BUT NO ENTITY ({len(db_only_tables)}):")
        for t in sorted(db_only_tables):
            print(f"  - {t} ({len(db_schema[t])} columns)")

    # ── 요약 ──
    print(f"\n{'='*70}")
    print(f"SUMMARY:")
    print(f"  DB tables:     {len(db_schema)}")
    print(f"  Entity tables: {len(entity_schema)}")
    print(f"  Tables with mismatches: {mismatch_count}")
    print(f"  Tables in DB only: {len(db_only_tables)}")
    db_matched = set(db_schema.keys()) & set(entity_schema.keys())
    ok_count = len(db_matched) - sum(
        1 for t in db_matched
        if (db_schema[t] - IGNORE_COLUMNS) != (entity_schema[t]['columns'] - IGNORE_COLUMNS)
    )
    print(f"  Tables fully matched: {ok_count}")


if __name__ == '__main__':
    main()
