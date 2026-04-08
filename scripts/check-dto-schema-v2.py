"""
DTO vs Entity 스키마 불일치 체크 (v2)
- Create/Update/Response DTO의 필드가 실제 Entity @Column 과 다른지 체크
- Query/Filter DTO (search, startDate 같은 필터 파라미터)는 제외
- 실제로 DB에 저장해야 하는 필드만 비교
"""
import os, re, sys
from pathlib import Path

BASE = Path("C:/Project/HANES/apps/backend/src")
ENTITIES_DIR = BASE / "entities"
MODULES_DIR = BASE / "modules"

def to_snake(name: str) -> str:
    s = re.sub(r'([A-Z])', r'_\1', name).lstrip('_').upper()
    return s

def parse_entity_columns(path: Path):
    """엔티티의 모든 @Column 정의 추출 → {camelProp: DB_COL_NAME}"""
    text = path.read_text(encoding='utf-8', errors='ignore')
    lines = text.splitlines()
    cols = {}

    for i, line in enumerate(lines):
        # @Column({ name: 'COL_NAME' })
        named_match = re.search(r"name\s*:\s*['\"]([A-Z0-9_]+)['\"]", line)
        # @Column() 또는 @Column({ type: ... })
        has_column = '@Column' in line

        if has_column:
            db_col = named_match.group(1) if named_match else None
            # 다음 줄에서 프로퍼티명
            for j in range(i+1, min(i+5, len(lines))):
                prop_match = re.match(r'\s+(\w+)[?!]?\s*[=:]', lines[j])
                if prop_match:
                    prop = prop_match.group(1)
                    if prop not in ('constructor',):
                        if db_col is None:
                            db_col = to_snake(prop)
                        cols[prop] = db_col
                        cols[db_col] = db_col  # DB명도 키로 추가
                    break

    # Primary key 컬럼도 추출 (@PrimaryColumn, @PrimaryGeneratedColumn)
    for i, line in enumerate(lines):
        if '@PrimaryColumn' in line or '@PrimaryGeneratedColumn' in line:
            named_match = re.search(r"name\s*:\s*['\"]([A-Z0-9_]+)['\"]", line)
            db_col = named_match.group(1) if named_match else None
            for j in range(i+1, min(i+5, len(lines))):
                prop_match = re.match(r'\s+(\w+)[?!]?\s*[=:]', lines[j])
                if prop_match:
                    prop = prop_match.group(1)
                    if db_col is None:
                        db_col = to_snake(prop)
                    cols[prop] = db_col
                    cols[db_col] = db_col
                    break

    table_match = re.search(r"@Entity\s*\(\s*['\"]([^'\"]+)['\"]", text)
    table_name = table_match.group(1) if table_match else path.stem

    return table_name, cols

def parse_dto_classes(path: Path):
    """DTO 파일에서 클래스별 필드 추출"""
    text = path.read_text(encoding='utf-8', errors='ignore')
    lines = text.splitlines()

    classes = {}
    current_class = None
    brace_depth = 0
    in_class = False

    for i, line in enumerate(lines):
        # 클래스 시작
        class_match = re.match(r'\s*export\s+class\s+(\w+)', line)
        if class_match:
            current_class = class_match.group(1)
            classes[current_class] = set()
            in_class = True
            brace_depth = 0

        if in_class:
            brace_depth += line.count('{') - line.count('}')
            if brace_depth <= 0 and current_class:
                in_class = False
                current_class = None
            elif current_class:
                # 프로퍼티 파싱
                prop_match = re.match(r'\s+(\w+)[?!]?\s*:', line)
                if prop_match:
                    name = prop_match.group(1)
                    skip = {'constructor', 'return', 'if', 'const', 'let', 'this',
                            'else', 'for', 'while', 'switch', 'case', 'break',
                            'true', 'false', 'null', 'undefined', 'type'}
                    if name not in skip and not name.startswith('_'):
                        classes[current_class].add(name)

    return classes

# 수동으로 검토가 필요한 DTO-Entity 페어 정의
# (dto_file_stem, entity_file_stem, create_class_hint, entity_context)
KNOWN_PAIRS = [
    # equipment module
    ("equip-master", "equip-master", ["CreateEquipMasterDto", "UpdateEquipMasterDto"]),
    ("equip-inspect", "equip-inspect-log", ["CreateEquipInspectLogDto"]),
    ("mold", "mold-master", ["CreateMoldDto", "UpdateMoldDto"]),
    ("pm-plan", "pm-plan", ["CreatePmPlanDto", "UpdatePmPlanDto"]),
    ("sensor-monitor", "equip-condition-rule", ["CreateConditionRuleDto"]),
    # master module
    ("bom", "bom-master", ["CreateBomDto", "UpdateBomDto"]),
    ("company", "company-master", ["CreateCompanyDto", "UpdateCompanyDto"]),
    ("department", "department-master", ["CreateDepartmentDto", "UpdateDepartmentDto"]),
    ("equip-bom", "equip-bom-item", ["CreateEquipBomItemDto"]),
    ("iqc-group", "iqc-group", ["CreateIqcGroupDto", "UpdateIqcGroupDto"]),
    ("iqc-item", "iqc-item-master", ["CreateIqcItemDto", "UpdateIqcItemDto"]),
    ("iqc-item-pool", "iqc-item-pool", ["CreateIqcItemPoolDto"]),
    ("iqc-part-link", "iqc-part-link", ["CreateIqcPartLinkDto"]),
    ("label-template", "label-template", ["CreateLabelTemplateDto", "UpdateLabelTemplateDto"]),
    ("model-suffix", "model-suffix", ["CreateModelSuffixDto"]),
    ("part", "part-master", ["CreatePartDto", "UpdatePartDto"]),
    ("partner", "partner-master", ["CreatePartnerDto", "UpdatePartnerDto"]),
    ("plant", "plant-master", ["CreatePlantDto", "UpdatePlantDto"]),
    ("process", "process-master", ["CreateProcessDto", "UpdateProcessDto"]),
    ("process-capa", "process-capa", ["CreateProcessCapaDto"]),
    ("prod-line", "prod-line", ["CreateProdLineDto", "UpdateProdLineDto"]),
    # inventory module
    ("product-inventory", "mat-stock", []),
    ("product-hold", "product-hold", ["CreateHoldDto"]),
    # customs module
    ("customs", "customs-entry", ["CreateCustomsEntryDto", "UpdateCustomsEntryDto"]),
    # consumables
    ("consumables", "consumable-master", ["CreateConsumableDto", "UpdateConsumableDto"]),
    ("consumable", "consumable-log", ["CreateConsumableLogDto"]),
]

# 1. 엔티티 로드
entities = {}
for p in ENTITIES_DIR.glob("*.entity.ts"):
    table, cols = parse_entity_columns(p)
    entities[p.stem.replace('.entity', '')] = (table, cols)

print(f"엔티티 {len(entities)}개 로드\n")
print("=" * 70)

# 2. git diff 기준 수정된 DTO
import subprocess
result = subprocess.run(
    ['git', 'diff', '--name-only', 'HEAD'],
    cwd='C:/Project/HANES',
    capture_output=True, text=True
)
modified = set(Path(f.strip()).stem.replace('.dto','') for f in result.stdout.splitlines() if f.endswith('.dto.ts'))

total_issues = 0

for pair in KNOWN_PAIRS:
    dto_stem, ent_stem, hint_classes = pair

    # 수정된 DTO만 체크 (또는 전체 체크)
    # if dto_stem not in modified:
    #     continue

    # DTO 파일 찾기
    dto_files = list(MODULES_DIR.rglob(f"{dto_stem}.dto.ts"))
    if not dto_files:
        continue
    dto_path = dto_files[0]

    # 엔티티 찾기
    ent_data = entities.get(ent_stem)
    if not ent_data:
        # fuzzy match
        for k in entities:
            if ent_stem in k or k in ent_stem:
                ent_data = entities[k]
                ent_stem_actual = k
                break
        if not ent_data:
            print(f"⚠️  엔티티 못찾음: {ent_stem}")
            continue

    table_name, ent_cols = ent_data
    dto_classes = parse_dto_classes(dto_path)

    found_issues = []

    for class_name, fields in dto_classes.items():
        # Create/Update DTO만 검사
        is_mutation_dto = (
            any(h in class_name for h in ['Create', 'Update', 'Save', 'Register']) or
            (hint_classes and class_name in hint_classes)
        )
        if not is_mutation_dto:
            continue

        for field in fields:
            # 표준 제외 필드
            skip_fields = {'id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy',
                          'updatedBy', 'companyId', 'plantCd', 'plantId',
                          'COMPANY', 'PLANT_CD', 'sort', 'page', 'limit', 'search'}
            if field in skip_fields:
                continue

            # 엔티티에 있는지 확인 (camel 또는 SNAKE 모두)
            if field not in ent_cols and to_snake(field) not in ent_cols.values():
                found_issues.append(f"    {class_name}.{field} → {to_snake(field)} (엔티티에 없음)")

    if found_issues:
        total_issues += len(found_issues)
        modified_marker = " 🔴 (수정됨)" if dto_stem in modified else ""
        print(f"\n[{dto_stem}.dto.ts] ↔ [{ent_stem}]{modified_marker}")
        for issue in found_issues:
            print(issue)

print("\n" + "=" * 70)
if total_issues == 0:
    print("✅ Create/Update DTO 기준 명백한 스키마 불일치 없음")
else:
    print(f"🚨 총 {total_issues}건 잠재적 불일치 발견")
    print("\n주의: 일부는 JOIN으로 가져오는 computed field이거나 서비스 레이어에서 처리할 수 있음")
    print("실제 DB INSERT/UPDATE 쿼리와 비교 필요")
