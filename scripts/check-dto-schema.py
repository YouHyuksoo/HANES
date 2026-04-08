"""
DTO vs Entity 스키마 불일치 체크 스크립트
- Entity @Column(name: 'COL_NAME') 기준으로 DB 컬럼명 추출
- DTO 필드명(camelCase) → UPPER_SNAKE_CASE 변환 후 매핑 비교
"""
import os, re, sys
from pathlib import Path

BASE = Path("C:/Project/HANES/apps/backend/src")
ENTITIES_DIR = BASE / "entities"
MODULES_DIR = BASE / "modules"

def to_snake(name: str) -> str:
    """camelCase → UPPER_SNAKE_CASE"""
    s = re.sub(r'([A-Z])', r'_\1', name).lstrip('_').upper()
    return s

def parse_entity(path: Path):
    """엔티티에서 {camelName: dbColName, type} 매핑 추출"""
    text = path.read_text(encoding='utf-8', errors='ignore')
    cols = {}
    # @Column({ name: 'COL_NAME', ... }) 또는 @Column('COL_NAME')
    # 다음 줄에 있는 프로퍼티명과 연결
    lines = text.splitlines()
    for i, line in enumerate(lines):
        col_match = re.search(r"@Column\s*\(\s*(?:\{[^}]*name\s*:\s*['\"]([A-Z0-9_]+)['\"][^}]*\}|['\"]([A-Z0-9_]+)['\"])\s*\)", line)
        simple_col = re.search(r"@Column\s*\(\s*\)", line)  # @Column() - no name
        if col_match or simple_col:
            db_col = col_match.group(1) or col_match.group(2) if col_match else None
            # 다음 몇 줄에서 프로퍼티명 찾기
            for j in range(i+1, min(i+4, len(lines))):
                prop_match = re.match(r'\s+(\w+)[?!]?\s*:', lines[j])
                if prop_match:
                    prop_name = prop_match.group(1)
                    if db_col is None:
                        db_col = to_snake(prop_name)
                    cols[prop_name] = db_col
                    break
    # 엔티티 테이블명
    table_match = re.search(r"@Entity\s*\(\s*['\"]([^'\"]+)['\"]", text)
    table_name = table_match.group(1) if table_match else path.stem
    return table_name, cols

def parse_dto(path: Path):
    """DTO에서 프로퍼티명 목록 추출"""
    text = path.read_text(encoding='utf-8', errors='ignore')
    # class 내 프로퍼티 (decorator 있는 것 우선)
    fields = set()
    lines = text.splitlines()
    for line in lines:
        m = re.match(r'\s+(\w+)[?!]?\s*[=:]', line)
        if m:
            name = m.group(1)
            if name not in ('constructor', 'return', 'if', 'const', 'let', 'this'):
                fields.add(name)
    return fields

def find_entity_for_dto(dto_path: Path, entities: dict):
    """DTO 경로/이름으로 매칭 엔티티 추측"""
    dto_stem = dto_path.stem.replace('.dto', '').replace('-', '')
    # 모듈 경로에서 키워드 추출
    parts = str(dto_path).replace('\\', '/').split('/')
    module_hint = parts[-3] if len(parts) >= 3 else ''

    candidates = []
    for ent_path, (table, cols) in entities.items():
        ent_stem = ent_path.replace('.entity', '').replace('-', '')
        if dto_stem in ent_stem or ent_stem in dto_stem:
            candidates.append((ent_path, table, cols))
    return candidates

# 1. 모든 엔티티 파싱
print("=== 엔티티 파싱 중... ===\n")
entities = {}
for p in ENTITIES_DIR.glob("*.entity.ts"):
    table, cols = parse_entity(p)
    entities[p.stem] = (table, cols)

print(f"파싱된 엔티티: {len(entities)}개\n")

# 2. 수정된 DTO 파일들만 우선 체크 (git diff 기준)
import subprocess
result = subprocess.run(
    ['git', 'diff', '--name-only', 'HEAD'],
    cwd='C:/Project/HANES',
    capture_output=True, text=True
)
modified_dtos = [
    Path('C:/Project/HANES') / f.strip()
    for f in result.stdout.splitlines()
    if f.endswith('.dto.ts')
]

if not modified_dtos:
    # 전체 DTO 파일 체크
    modified_dtos = list(MODULES_DIR.rglob("*.dto.ts"))

print(f"체크할 DTO 파일: {len(modified_dtos)}개\n")
print("=" * 70)

issues = []

for dto_path in modified_dtos:
    if not dto_path.exists():
        continue

    dto_fields = parse_dto(dto_path)
    candidates = find_entity_for_dto(dto_path, entities)

    if not candidates:
        continue

    for ent_name, table, ent_cols in candidates:
        mismatches = []

        for field in dto_fields:
            if field in ('id', 'createdAt', 'updatedAt', 'deletedAt'):
                continue
            expected_col = to_snake(field)
            if field not in ent_cols:
                # DB 컬럼명으로 직접 있는지 확인
                col_values = list(ent_cols.values())
                if expected_col not in col_values:
                    # DTO에는 있지만 엔티티에 없음
                    mismatches.append(f"  [DTO전용?] {field} (예상 DB컬럼: {expected_col}) → 엔티티 {ent_name}에 없음")

        for ent_field, db_col in ent_cols.items():
            expected_dto = ent_field  # camelCase
            # DTO에 없는 엔티티 컬럼 (필수 필드면 문제)
            if ent_field not in dto_fields and db_col not in [to_snake(f) for f in dto_fields]:
                pass  # DTO에 모든 엔티티 컬럼이 없어도 됨 (정상)

        if mismatches:
            issues.append(f"\n[{dto_path.name}] ↔ [{ent_name}] (테이블: {table})")
            issues.extend(mismatches)

if issues:
    print("\n🚨 잠재적 불일치 발견:")
    for issue in issues:
        print(issue)
else:
    print("\n✅ 명백한 불일치 없음 (엔티티 매핑 기준)")

print("\n\n=== 엔티티-DTO 매핑 요약 (수동 검토용) ===\n")
for dto_path in modified_dtos[:10]:
    if not dto_path.exists():
        continue
    dto_fields = parse_dto(dto_path)
    candidates = find_entity_for_dto(dto_path, entities)
    if candidates:
        ent_name, table, ent_cols = candidates[0]
        print(f"\n{dto_path.name} ↔ {ent_name}")
        print(f"  DTO fields: {sorted(list(dto_fields))[:8]}...")
        print(f"  Entity cols: {list(ent_cols.keys())[:8]}...")
