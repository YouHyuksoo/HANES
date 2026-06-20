# IQC 검사유형 분리 (AQL/파괴검사) 1단계 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** IQC 검사항목을 검사유형(AQL/파괴/전수)으로 분리해, 파괴검사를 AQL 샘플링과 독립된 고정 샘플수·무관용(불량 1건+ FAIL)으로 판정하고 LOT 결과에 종합한다.

**Architecture:** `IQC_PART_SPEC_ITEMS`에 검사유형 컬럼 3개(INSPECTION_TYPE/SAMPLE_METHOD/SAMPLE_QTY)를 추가하고, 백엔드 `resolveIqcPolicyByItem`이 항목을 검사유형별로 분기 판정한다. 파괴검사는 검사 모달의 별도 입력 영역에서 항목별 검사수량·불량수를 받아 `details` JSON의 `destructive` 섹션으로 전달한다. 기존 AQL 시리얼 매트릭스는 그대로 유지하며, 검사유형 미설정 항목은 전부 AQL로 간주(하위호환).

**Tech Stack:** NestJS + TypeORM(Oracle), Next.js(React 19, react-i18next), Jest(백엔드 단위테스트), node:test structure test(.mjs), Python(oracledb) 시드.

## Global Constraints

- Oracle 사이트 `JSHANES`, 멀티테넌시 `COMPANY='40'`, `PLANT_CD='1000'`.
- 신규 NUMBER 컬럼은 TypeORM `@Column({ type: 'decimal' })` 또는 `'int'`만 사용(`'number'` 금지 — BE 부팅 실패).
- VARCHAR2 컬럼은 `name: 'UPPER_SNAKE_CASE'` 명시.
- 컬럼은 전부 NULLABLE ADD(비파괴) — 기존 행은 `INSPECTION_TYPE` NULL → 코드에서 'AQL'로 간주.
- i18n 변경 시 **ko/en/zh/vi 4개 파일** 동시 수정.
- DDL 실행 후 의존 PL/SQL(`IQC_PART_SPEC_ITEMS`/`IQC_LOGS` 참조 패키지) `ALTER ... COMPILE` 점검(ORA-04068 방지).
- `alert()/confirm()/prompt()` 금지 — 모달 컴포넌트 사용.
- 커밋은 파일 단위 `git add`(디렉토리 단위 금지), push는 하지 않는다(사용자 명시 시에만).

---

### Task 1: DDL + 공통코드 (스키마·코드 준비)

**Files:**
- Create: `tools/seed/seed_iqc_inspection_type.py`
- DDL: `IQC_PART_SPEC_ITEMS` 3컬럼 ADD (oracle-db 스킬로 실행)

**Interfaces:**
- Produces: 컬럼 `INSPECTION_TYPE`(VARCHAR2 12) / `SAMPLE_METHOD`(VARCHAR2 8) / `SAMPLE_QTY`(NUMBER), 공통코드 그룹 `IQC_INSPECT_TYPE`(AQL/DESTRUCTIVE/FULL), `IQC_SAMPLE_METHOD`(AQL/FIXED).

- [ ] **Step 1: 실제 스키마 확인 (현재 컬럼 존재 여부)**

Run:
```bash
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES \
  --query "SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME='IQC_PART_SPEC_ITEMS' ORDER BY COLUMN_ID"
```
Expected: `INSPECTION_TYPE`/`SAMPLE_METHOD`/`SAMPLE_QTY`가 **없어야** 함(있으면 이 Step의 ADD 건너뜀). `INSPECTION_LEVEL`/`AQL`/`DEFECT_GRADE`는 이미 존재.

- [ ] **Step 2: DDL 파일 작성 후 실행**

Create `tools/seed/ddl_iqc_inspection_type.sql`:
```sql
ALTER TABLE IQC_PART_SPEC_ITEMS ADD (
  INSPECTION_TYPE VARCHAR2(12),
  SAMPLE_METHOD   VARCHAR2(8),
  SAMPLE_QTY      NUMBER
);
/
COMMENT ON COLUMN IQC_PART_SPEC_ITEMS.INSPECTION_TYPE IS '검사유형 AQL/DESTRUCTIVE/FULL (IQC_INSPECT_TYPE)';
/
COMMENT ON COLUMN IQC_PART_SPEC_ITEMS.SAMPLE_METHOD IS '샘플방식 AQL(자동)/FIXED(고정) (IQC_SAMPLE_METHOD)';
/
COMMENT ON COLUMN IQC_PART_SPEC_ITEMS.SAMPLE_QTY IS 'FIXED/DESTRUCTIVE 고정 샘플수(LOT당)';
/
```

Run:
```bash
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES \
  --execute-file tools/seed/ddl_iqc_inspection_type.sql
```
Expected: `blocks_executed: 4`, 각 success. 실패 시 ORA 코드 확인.

- [ ] **Step 3: 의존 PL/SQL 무효화 점검·재컴파일**

Run:
```bash
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES \
  --query "SELECT OBJECT_NAME, OBJECT_TYPE, STATUS FROM USER_OBJECTS WHERE STATUS='INVALID'"
```
Expected: INVALID가 없거나, 있으면 `ALTER PACKAGE <name> COMPILE;`로 VALID 복원 후 재조회 시 0건.

- [ ] **Step 4: 공통코드 시드 작성**

Create `tools/seed/seed_iqc_inspection_type.py` (기존 `seed_iqc_aql_link.py`의 oracledb 연결 패턴 그대로):
```python
# -*- coding: utf-8 -*-
"""IQC 검사유형/샘플방식 공통코드 시드 (IQC_INSPECT_TYPE, IQC_SAMPLE_METHOD)."""
import json, os, sys, oracledb

COMMIT = "--commit" in sys.argv
CO, PLANT, WORKER = "40", "1000", "seed"

GROUPS = {
    "IQC_INSPECT_TYPE": [
        ("AQL", "AQL샘플링", 1),
        ("DESTRUCTIVE", "파괴검사", 2),
        ("FULL", "전수검사", 3),
    ],
    "IQC_SAMPLE_METHOD": [
        ("AQL", "AQL자동", 1),
        ("FIXED", "고정수량", 2),
    ],
}

with open(os.path.expanduser("~/.oracle_db_config.json"), encoding="utf-8") as f:
    cfg = json.load(f)["profiles"]["JSHANES"]
conn = oracledb.connect(user=cfg["user"], password=cfg["password"],
                        dsn=f"{cfg['host']}:{cfg['port']}/{cfg['service_name']}")
conn.autocommit = False
cur = conn.cursor()

ins = 0
for group, rows in GROUPS.items():
    for code, name, order in rows:
        cur.execute(
            "SELECT COUNT(*) FROM COM_CODES WHERE COMPANY=:1 AND PLANT_CD=:2 AND GROUP_CODE=:3 AND DETAIL_CODE=:4",
            [CO, PLANT, group, code],
        )
        if cur.fetchone()[0] > 0:
            continue
        cur.execute(
            """INSERT INTO COM_CODES (COMPANY, PLANT_CD, GROUP_CODE, DETAIL_CODE, CODE_NAME, SORT_ORDER, USE_YN, CREATED_BY, UPDATED_BY)
                 VALUES (:co,:pl,:g,:d,:n,:o,'Y',:w,:w)""",
            dict(co=CO, pl=PLANT, g=group, d=code, n=name, o=order, w=WORKER),
        )
        ins += cur.rowcount
print(f"[INSERT] COM_CODES {ins}건")

if COMMIT:
    conn.commit(); print(">>> COMMITTED")
else:
    conn.rollback(); print(">>> DRY-RUN (--commit 필요)")
conn.close()
```

- [ ] **Step 5: 공통코드 컬럼명 실측 확인 후 시드 dry-run**

Run:
```bash
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES \
  --query "SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME='COM_CODES' ORDER BY COLUMN_ID"
```
Expected: 위 INSERT의 컬럼명(`GROUP_CODE`/`DETAIL_CODE`/`CODE_NAME`/`SORT_ORDER`/`USE_YN`)이 실제와 일치하는지 확인. 다르면 시드의 컬럼명을 실측값으로 교정.

Run: `python tools/seed/seed_iqc_inspection_type.py`
Expected: `[INSERT] COM_CODES 5건`, `DRY-RUN`.

- [ ] **Step 6: 시드 커밋(반영)**

Run: `python tools/seed/seed_iqc_inspection_type.py --commit`
Expected: `COMMITTED`. 재실행 시 `[INSERT] COM_CODES 0건`(멱등).

- [ ] **Step 7: Commit**

```bash
git add tools/seed/ddl_iqc_inspection_type.sql tools/seed/seed_iqc_inspection_type.py
git commit -m "feat(iqc): 검사유형 컬럼 DDL + 공통코드 시드"
```

---

### Task 2: 엔티티 + DTO 확장 (검사유형 영속 필드)

**Files:**
- Modify: `apps/backend/src/entities/iqc-part-spec-item.entity.ts` (50행 `aql` 뒤)
- Modify: `apps/backend/src/modules/master/dto/iqc-part-spec.dto.ts:42` (`aql` 뒤)
- Test: `apps/backend/src/entities/iqc-part-spec.entity.spec.ts` (기존 파일에 케이스 추가)

**Interfaces:**
- Produces: `IqcPartSpecItem.inspectionType: string | null`, `.sampleMethod: string | null`, `.sampleQty: number | null`. DTO 필드 `inspectionType?`, `sampleMethod?`, `sampleQty?`.

- [ ] **Step 1: 엔티티에 컬럼 추가**

Modify `iqc-part-spec-item.entity.ts` — 50행(`aql: number | null;`) 다음에 삽입:
```ts
  /** 검사유형 AQL/DESTRUCTIVE/FULL (IQC_INSPECT_TYPE). NULL=AQL로 간주 */
  @Column({ name: 'INSPECTION_TYPE', type: 'varchar2', length: 12, nullable: true })
  inspectionType: string | null;

  /** 샘플방식 AQL(자동)/FIXED(고정) (IQC_SAMPLE_METHOD). NULL=AQL */
  @Column({ name: 'SAMPLE_METHOD', type: 'varchar2', length: 8, nullable: true })
  sampleMethod: string | null;

  /** FIXED/DESTRUCTIVE 고정 샘플수(LOT당) */
  @Column({ name: 'SAMPLE_QTY', type: 'decimal', precision: 10, scale: 0, nullable: true })
  sampleQty: number | null;
```

- [ ] **Step 2: DTO에 필드 추가**

Modify `iqc-part-spec.dto.ts` — `IqcPartSpecItemDto`의 `aql?` 필드(41행) 다음에 삽입:
```ts
  @IsOptional()
  @IsString()
  @IsIn(['AQL', 'DESTRUCTIVE', 'FULL'])
  inspectionType?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(['AQL', 'FIXED'])
  sampleMethod?: string | null;

  @IsOptional()
  @IsNumber()
  sampleQty?: number | null;
```

- [ ] **Step 3: 엔티티 메타데이터 로드 테스트(BE 부팅 안전성)**

Modify `apps/backend/src/entities/iqc-part-spec.entity.spec.ts` — 기존 패턴 따라 케이스 추가(파일 상단 import/describe 재사용):
```ts
it('IqcPartSpecItem 검사유형 컬럼이 decimal/varchar2로 매핑된다', () => {
  const cols = new (require('typeorm').DataSource)({ type: 'oracle', entities: [IqcPartSpecItem], synchronize: false });
  // 메타데이터 수준 검증: 컬럼명 존재
  const item = new IqcPartSpecItem();
  item.inspectionType = 'DESTRUCTIVE';
  item.sampleMethod = 'FIXED';
  item.sampleQty = 5;
  expect(item.inspectionType).toBe('DESTRUCTIVE');
  expect(item.sampleQty).toBe(5);
});
```
> 주의: 기존 `iqc-part-spec.entity.spec.ts`가 어떤 검증 방식인지 먼저 Read하여 그 방식에 맞춰 작성(위 코드는 단순 인스턴스 검증 예시). DataSource를 띄우지 않는 순수 단위 검증으로 유지.

- [ ] **Step 4: 테스트 실행**

Run: `pnpm --filter @harness/backend exec jest iqc-part-spec.entity.spec`
Expected: PASS.

- [ ] **Step 5: 타입 체크**

Run: `pnpm --filter @harness/backend exec tsc --noEmit`
Expected: 에러 0건.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/entities/iqc-part-spec-item.entity.ts apps/backend/src/modules/master/dto/iqc-part-spec.dto.ts apps/backend/src/entities/iqc-part-spec.entity.spec.ts
git commit -m "feat(iqc): 검사항목 검사유형 엔티티/DTO 필드"
```

---

### Task 3: 검사계획 저장/조회 서비스 확장

**Files:**
- Modify: `apps/backend/src/modules/master/services/iqc-part-spec.service.ts` (upsert 98-115행, resolveItems 129-167행)
- Test: `apps/backend/src/modules/master/services/iqc-part-spec.service.spec.ts`

**Interfaces:**
- Consumes: DTO `inspectionType/sampleMethod/sampleQty` (Task 2).
- Produces: `resolveItems()` 반환 객체에 `inspectionType: string`, `sampleMethod: string`, `sampleQty: number | null` 추가 — 검사 모달이 검사유형을 알 수 있게 함.

- [ ] **Step 1: upsert 저장 필드 추가**

Modify `iqc-part-spec.service.ts` — `upsert()`의 `newItems` 매핑(98-115행) `aql: it.aql ?? null,` 다음에 추가:
```ts
            inspectionType: it.inspectionType ?? null,
            sampleMethod: it.sampleMethod ?? null,
            sampleQty: it.sampleQty ?? null,
```

- [ ] **Step 2: resolveItems 반환 타입·매핑 확장**

Modify `resolveItems()` 반환 타입(133-146행)에 추가(`inspItemCode`도 함께 — 검사 모달 파괴검사 payload가 사용):
```ts
    inspItemCode: string;
    inspectionType: string;
    sampleMethod: string;
    sampleQty: number | null;
```
그리고 `.map(...)` 반환객체(165행 `aql:` 다음)에 추가:
```ts
        inspItemCode: item.inspItemCode,
        inspectionType: (item.inspectionType ?? 'AQL').toUpperCase(),
        sampleMethod: (item.sampleMethod ?? 'AQL').toUpperCase(),
        sampleQty: item.sampleQty != null ? Number(item.sampleQty) : null,
```

- [ ] **Step 3: 서비스 단위테스트 추가**

Modify `iqc-part-spec.service.spec.ts` — resolveItems가 파괴검사 항목의 검사유형을 반환하는지 검증(기존 mock 패턴 재사용):
```ts
it('resolveItems가 파괴검사 항목의 inspectionType/sampleQty를 반환한다', async () => {
  mockSpecRepo.findOne.mockResolvedValue({
    itemCode: 'CBL-A', items: [
      { seq: 1, useYn: 'Y', inspItemCode: 'IQC-PULL', inspItem: { inspItemName: '인장', judgeMethod: 'MEASURE', unit: 'N' },
        lsl: null, usl: null, judgeCriteria: null, defectGrade: 'MAJOR',
        inspectionLevel: null, aql: null, inspectionType: 'DESTRUCTIVE', sampleMethod: 'FIXED', sampleQty: 5 },
    ],
  });
  const res = await service.resolveItems('CBL-A', '40', '1000');
  expect(res[0].inspectionType).toBe('DESTRUCTIVE');
  expect(res[0].sampleQty).toBe(5);
});
```
> 기존 spec의 mock 변수명/구조를 먼저 Read하여 정확히 맞출 것.

- [ ] **Step 4: 테스트 실행**

Run: `pnpm --filter @harness/backend exec jest iqc-part-spec.service.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/master/services/iqc-part-spec.service.ts apps/backend/src/modules/master/services/iqc-part-spec.service.spec.ts
git commit -m "feat(iqc): 검사계획 저장/조회에 검사유형 반영"
```

---

### Task 4: 판정 엔진 검사유형 분기 (`resolveIqcPolicyByItem`)

**Files:**
- Modify: `apps/backend/src/modules/quality/aql/services/aql.service.ts` (타입 34-45행, 메서드 275-411행)
- Test: `apps/backend/src/modules/quality/aql/services/aql.service.spec.ts`

**Interfaces:**
- Consumes: `IqcPartSpecItem.inspectionType/sampleMethod/sampleQty`(Task 2), 호출자가 넘기는 `itemInspectedCounts`(Task 5).
- Produces: `IqcItemJudgeResult`에 `inspectionType: string`, `requiredQty: number | null`, `inspectedQty: number | null` 추가. `resolveIqcPolicyByItem` input에 `itemInspectedCounts?: Record<number, number>` 추가. 폴백/AQL 동작은 불변.

- [ ] **Step 1: 실패 테스트 작성 — 파괴검사 무관용 판정**

Modify `aql.service.spec.ts` — 기존 `resolveIqcPolicyByItem` describe에 추가(기존 mock `specItemRepo.find` 패턴 재사용):
```ts
it('파괴검사 항목은 불량 1건이면 FAIL, AQL과 무관하게 판정한다', async () => {
  mockSpecItemRepo.find.mockResolvedValue([
    { seq: 1, inspItemCode: 'IQC-VISUAL', defectGrade: 'MINOR', inspectionLevel: 'II', aql: 2.5, inspectionType: 'AQL', sampleMethod: 'AQL', sampleQty: null },
    { seq: 2, inspItemCode: 'IQC-PULL', defectGrade: 'MAJOR', inspectionLevel: null, aql: null, inspectionType: 'DESTRUCTIVE', sampleMethod: 'FIXED', sampleQty: 5 },
  ]);
  mockPartRepo.findOne.mockResolvedValue({ itemCode: 'CBL-A', inspectionLevel: 'II' });
  mockPartnerRepo.findOne.mockResolvedValue(null);
  // 외관 AQL Ac5/Re6 가정
  jest.spyOn(service as any, 'resolveSeverityRule').mockResolvedValue({ aqlCode: 'AQL-II-2.5', aqlValue: 2.5, codeLetter: 'F', sampleSize: 80, acceptQty: 5, rejectQty: 6 });

  const res = await service.resolveIqcPolicyByItem({
    itemCode: 'CBL-A', vendorCode: null, lotQty: 1200,
    itemDefectCounts: { 1: 0, 2: 1 },           // 외관 0, 인장 1
    itemInspectedCounts: { 2: 5 },
    company: '40', plant: '1000',
  });

  expect(res.result).toBe('FAIL');
  const pull = res.itemResults!.find((r) => r.inspItemCode === 'IQC-PULL')!;
  expect(pull.inspectionType).toBe('DESTRUCTIVE');
  expect(pull.requiredQty).toBe(5);
  expect(pull.inspectedQty).toBe(5);
  expect(pull.result).toBe('FAIL');
  const visual = res.itemResults!.find((r) => r.inspItemCode === 'IQC-VISUAL')!;
  expect(visual.result).toBe('PASS');   // 외관 0건은 PASS
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter @harness/backend exec jest aql.service.spec -t "파괴검사 항목은 불량"`
Expected: FAIL (현재 inspectionType 미분기, requiredQty/inspectedQty 없음).

- [ ] **Step 3: 판정결과 타입 확장**

Modify `aql.service.ts` `IqcItemJudgeResult`(34-45행) — `reason: string;` 앞에 추가:
```ts
  inspectionType: string;
  requiredQty: number | null;
  inspectedQty: number | null;
```

- [ ] **Step 4: input에 itemInspectedCounts 추가 + 활성항목 필터 확장**

Modify `resolveIqcPolicyByItem` input 시그니처(275-283행) — `itemDefectCounts` 다음에 추가:
```ts
    itemInspectedCounts?: Record<number, number>; // seq -> 실제 검사수량(파괴/전수용)
```
그리고 `gradedItems` 필터(294-296행)를 교체:
```ts
    const activeItems = specItems.filter((item) => {
      const grade = String(item.defectGrade ?? '').trim().toUpperCase();
      const type = String(item.inspectionType ?? 'AQL').trim().toUpperCase();
      return ['CRITICAL', 'MAJOR', 'MINOR'].includes(grade) || ['DESTRUCTIVE', 'FULL'].includes(type);
    });
```
이후 본문의 `gradedItems` 참조(299행 `if (gradedItems.length === 0)`, 343행 `for (const item of gradedItems)`)를 모두 `activeItems`로 변경.

- [ ] **Step 5: 판정 루프 검사유형 분기 구현**

Modify `resolveIqcPolicyByItem` 루프(343-393행) — 루프 본문을 아래로 교체:
```ts
    for (const item of activeItems) {
      const grade = String(item.defectGrade ?? '').trim().toUpperCase();
      const type = String(item.inspectionType ?? 'AQL').trim().toUpperCase();
      const method = String(item.sampleMethod ?? 'AQL').trim().toUpperCase();
      const level = (item.inspectionLevel || partLevel).trim().toUpperCase();
      const aql = item.aql != null ? Number(item.aql) : null;
      const defectCount = this.toNonNegativeInt(input.itemDefectCounts[item.seq]);

      if (grade === 'CRITICAL') defectCritical += defectCount;
      else if (grade === 'MAJOR') defectMajor += defectCount;
      else if (grade === 'MINOR') defectMinor += defectCount;

      let itemResult: 'PASS' | 'FAIL' = 'PASS';
      let reason = '';
      let rule: AqlSeverityRule | null = null;
      let requiredQty: number | null = null;
      let inspectedQty: number | null = null;

      if (type === 'DESTRUCTIVE' || type === 'FULL' || method === 'FIXED') {
        // 파괴/전수/고정 — AQL 무관, 불량 1건 이상이면 FAIL
        requiredQty = type === 'FULL' ? lotQty : this.toNonNegativeInt(item.sampleQty);
        inspectedQty = this.toNonNegativeInt(input.itemInspectedCounts?.[item.seq]) || requiredQty;
        if (defectCount > 0) {
          itemResult = 'FAIL';
          reason = `${item.inspItemCode} ${type === 'FULL' ? '전수' : '파괴'}검사 불량 ${defectCount}건`;
        }
      } else if (grade === 'CRITICAL') {
        requiredQty = inspectedQty = null;
        if (defectCount > 0) {
          itemResult = 'FAIL';
          reason = `${item.inspItemCode} Critical 불량 ${defectCount}건`;
        }
      } else if (aql != null) {
        rule = await this.resolveSeverityRule(level, inspectionMode, aql, lotQty, input.company, input.plant);
        sampleQty = Math.max(sampleQty, rule.sampleSize);
        requiredQty = inspectedQty = rule.sampleSize;
        if (grade === 'MAJOR' && !majorRule) majorRule = rule;
        if (grade === 'MINOR' && !minorRule) minorRule = rule;
        if (defectCount > rule.acceptQty) {
          itemResult = 'FAIL';
          reason = `${item.inspItemCode} ${grade} 불량 ${defectCount}건이 Ac ${rule.acceptQty} 초과`;
        }
      } else if (defectCount > 0) {
        itemResult = 'FAIL';
        reason = `${item.inspItemCode} ${grade} 불량 ${defectCount}건 (AQL 미설정)`;
      }

      if (itemResult === 'FAIL') {
        result = 'FAIL';
        failReasons.push(reason);
      }
      itemResults.push({
        seq: item.seq,
        inspItemCode: item.inspItemCode,
        defectGrade: grade,
        inspectionLevel: level,
        aql,
        defectCount,
        acceptQty: rule?.acceptQty ?? null,
        rejectQty: rule?.rejectQty ?? null,
        inspectionType: type,
        requiredQty,
        inspectedQty,
        result: itemResult,
        reason,
      });
    }
```

- [ ] **Step 6: 테스트 실행 — 통과 확인**

Run: `pnpm --filter @harness/backend exec jest aql.service.spec`
Expected: 신규 케이스 PASS + 기존 케이스 전부 PASS(폴백/AQL 불변).

- [ ] **Step 7: 타입 체크**

Run: `pnpm --filter @harness/backend exec tsc --noEmit`
Expected: 에러 0건.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/quality/aql/services/aql.service.ts apps/backend/src/modules/quality/aql/services/aql.service.spec.ts
git commit -m "feat(iqc): 판정 엔진 검사유형 분기(파괴/전수 무관용)"
```

---

### Task 5: 검사결과 등록 — 파괴검사 details 파싱

**Files:**
- Modify: `apps/backend/src/modules/material/services/iqc-history.service.ts` (countFailByInspItem 579-597행 인근, createArrivalResult 420-432행)
- Test: `apps/backend/src/modules/material/services/iqc-history.service.spec.ts`

**Interfaces:**
- Consumes: `resolveIqcPolicyByItem`의 `itemInspectedCounts`(Task 4).
- Produces: `details` JSON에 `destructive: [{seq, inspItemCode, requiredQty, inspectedQty, defectQty, result}]` 섹션 파싱. 파괴 항목 불량은 `itemDefectCounts`에, 검사수량은 `itemInspectedCounts`에 합류.

- [ ] **Step 1: 실패 테스트 작성 — 파괴검사 불량이 LOT FAIL로 종합**

Modify `iqc-history.service.spec.ts` — createArrivalResult describe에 추가(기존 mock `aqlService.resolveIqcPolicyByItem`/`matLotRepository` 패턴 재사용):
```ts
it('details.destructive의 불량을 파괴검사 판정에 합류시킨다', async () => {
  const details = JSON.stringify({
    type: 'SERIAL_INSPECTION',
    serials: [{ matUid: 'S1', result: 'PASS', items: [{ itemId: 'CBL-A::1', judge: 'PASS' }] }],
    destructive: [{ seq: 2, inspItemCode: 'IQC-PULL', requiredQty: 5, inspectedQty: 5, defectQty: 1, result: 'FAIL' }],
  });
  // ... 기존 createArrivalResult 테스트의 mock 셋업 재사용 (matLot find 1건 등)
  await service.createArrivalResult({ arrivalNo: 'A1', itemCode: 'CBL-A', result: 'PASS', details } as any, '40', '1000');

  const call = (aqlService.resolveIqcPolicyByItem as jest.Mock).mock.calls[0][0];
  expect(call.itemDefectCounts[2]).toBe(1);        // 파괴 불량 합류
  expect(call.itemInspectedCounts[2]).toBe(5);     // 검사수량 합류
});
```
> 기존 createArrivalResult 테스트의 mock 셋업(matLotRepository.find가 PENDING lot 배열 반환 등)을 그대로 차용해 위 `// ...` 부분을 채울 것.

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter @harness/backend exec jest iqc-history.service.spec -t "destructive"`
Expected: FAIL (아직 destructive 파싱 없음, itemInspectedCounts 미전달).

- [ ] **Step 3: 파괴검사 파싱 헬퍼 추가**

Modify `iqc-history.service.ts` — `countFailByInspItem`(597행) 다음에 추가:
```ts
  /**
   * details(SERIAL_INSPECTION)의 destructive 섹션에서 검사항목(seq)별 검사수량/불량수를 집계한다.
   */
  private parseDestructive(details?: string | null): {
    defects: Record<number, number>;
    inspected: Record<number, number>;
  } {
    const defects: Record<number, number> = {};
    const inspected: Record<number, number> = {};
    if (!details) return { defects, inspected };
    try {
      const parsed = JSON.parse(details) as {
        destructive?: Array<{ seq?: number; inspectedQty?: number; defectQty?: number }>;
      };
      for (const d of parsed.destructive ?? []) {
        const seq = Number(d.seq);
        if (!Number.isFinite(seq)) continue;
        defects[seq] = (defects[seq] ?? 0) + this.toNonNegativeInt(d.defectQty);
        inspected[seq] = (inspected[seq] ?? 0) + this.toNonNegativeInt(d.inspectedQty);
      }
    } catch {
      return { defects, inspected };
    }
    return { defects, inspected };
  }
```

- [ ] **Step 4: createArrivalResult에서 파괴검사 합류**

Modify `createArrivalResult` — 421행(`const itemDefectCounts = this.countFailByInspItem(dto.details);`) 다음에 삽입하고 호출부 수정:
```ts
    const destructive = this.parseDestructive(dto.details);
    for (const [seq, qty] of Object.entries(destructive.defects)) {
      itemDefectCounts[Number(seq)] = (itemDefectCounts[Number(seq)] ?? 0) + qty;
    }
```
그리고 `resolveIqcPolicyByItem` 호출(423-432행)에 인자 추가:
```ts
      itemDefectCounts,
      itemInspectedCounts: destructive.inspected,
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

Run: `pnpm --filter @harness/backend exec jest iqc-history.service.spec`
Expected: 신규 + 기존 전부 PASS.

- [ ] **Step 6: 타입 체크 + Commit**

Run: `pnpm --filter @harness/backend exec tsc --noEmit` → 0건
```bash
git add apps/backend/src/modules/material/services/iqc-history.service.ts apps/backend/src/modules/material/services/iqc-history.service.spec.ts
git commit -m "feat(iqc): 검사결과 등록에 파괴검사 details 파싱 합류"
```

---

### Task 6: 검사계획 화면 — 검사유형/샘플방식/샘플수 컬럼

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/master/iqc-item/types.ts:32-46` (IqcSpecRow)
- Modify: `apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcSpecPanel.tsx` (그리드 헤더 296-307행, 편집행 322-440행, 읽기행 443-509행, load 63-76행, save 185-197행, addRow 108행)
- Test: `apps/frontend/src/app/(authenticated)/master/iqc-item/components/iqc-spec-inspection-type.structure.test.mjs`

**Interfaces:**
- Consumes: 공통코드 `IQC_INSPECT_TYPE`/`IQC_SAMPLE_METHOD`(Task 1), 백엔드 save/load 필드(Task 3).
- Produces: 화면에서 항목별 검사유형/샘플방식/샘플수 입력 → POST body에 포함.

- [ ] **Step 1: IqcSpecRow 타입 확장**

Modify `types.ts` — `IqcSpecRow`의 `aql?` 필드(44행) 다음에 추가:
```ts
  inspectionType?: string | null;   // AQL/DESTRUCTIVE/FULL (IQC_INSPECT_TYPE)
  sampleMethod?: string | null;     // AQL/FIXED (IQC_SAMPLE_METHOD)
  sampleQty?: number | null;        // FIXED/DESTRUCTIVE 고정 샘플수
```

- [ ] **Step 2: 공통코드 옵션 + load/save/addRow 반영**

Modify `IqcSpecPanel.tsx`:
- 옵션 훅 추가(48행 `aqlOptions` 다음):
```ts
  const inspectTypeOptions = useComCodeOptions("IQC_INSPECT_TYPE");
  const sampleMethodOptions = useComCodeOptions("IQC_SAMPLE_METHOD");
```
- `loadSpec` 매핑(74행 `aql:` 다음):
```ts
            inspectionType: it.inspectionType ?? null,
            sampleMethod: it.sampleMethod ?? null,
            sampleQty: it.sampleQty ?? null,
```
- `addRow` newRow(108행)에 `inspectionType: 'AQL', sampleMethod: 'AQL', sampleQty: null,` 추가.
- `handleSave` items 매핑(196행 `aql:` 다음):
```ts
            inspectionType: it.inspectionType ?? null,
            sampleMethod: it.sampleMethod ?? null,
            sampleQty: it.sampleQty ?? null,
```

- [ ] **Step 3: 그리드 헤더에 컬럼 추가**

Modify `IqcSpecPanel.tsx` 헤더(`<th>종류</th>` 298행 다음)에 추가:
```tsx
                  <th className="px-3 py-2 text-left text-text-muted font-medium w-24">검사유형</th>
                  <th className="px-3 py-2 text-left text-text-muted font-medium w-20">샘플수</th>
```
그리고 빈 상태 `colSpan={11}`(312행)을 `colSpan={13}`으로 변경.

- [ ] **Step 4: 편집행에 검사유형/샘플수 셀렉트·입력 추가**

Modify 편집행 — `종류` 셀(340-350행) 다음에 추가:
```tsx
                        <td className="px-3 py-2">
                          <select
                            value={draft.inspectionType ?? 'AQL'}
                            onChange={(e) => updateDraft('inspectionType', e.target.value)}
                            className="w-full border border-border rounded px-2 py-1 bg-surface text-text text-sm focus:border-primary focus:outline-none"
                          >
                            {inspectTypeOptions.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          {(draft.inspectionType === 'DESTRUCTIVE' || draft.inspectionType === 'FULL' || draft.sampleMethod === 'FIXED') ? (
                            <input
                              type="number"
                              min={1}
                              value={draft.sampleQty ?? ''}
                              onChange={(e) => updateDraft('sampleQty', e.target.value === '' ? null : Number(e.target.value))}
                              className="w-full border border-border rounded px-2 py-1 text-sm bg-surface text-text focus:border-primary focus:outline-none"
                              placeholder="고정수"
                            />
                          ) : <span className="text-text-muted text-xs">자동</span>}
                        </td>
```
> 검사유형이 DESTRUCTIVE/FULL이면 sampleMethod를 FIXED로 자동 처리하도록 `updateDraft`에 규칙 추가: `inspectionType` 변경 시 DESTRUCTIVE/FULL이면 `sampleMethod='FIXED'`, AQL이면 `sampleMethod='AQL', sampleQty=null`. `updateDraft`(157-174행)의 else 분기를 보강:
```ts
    } else if (field === 'inspectionType') {
      const v = value as string;
      setEditDraft({
        ...editDraft,
        inspectionType: v,
        sampleMethod: v === 'AQL' ? 'AQL' : 'FIXED',
        sampleQty: v === 'AQL' ? null : editDraft.sampleQty,
      });
    } else {
```

- [ ] **Step 5: 읽기행에 검사유형/샘플수 표시 추가**

Modify 읽기행 — `종류` 셀(452-462행) 다음에 추가:
```tsx
                      <td className="px-3 py-2">
                        {row.inspectionType && row.inspectionType !== 'AQL'
                          ? <ComCodeBadge groupCode="IQC_INSPECT_TYPE" code={row.inspectionType} />
                          : <span className="text-text-muted text-xs">AQL</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-text">
                        {(row.inspectionType === 'DESTRUCTIVE' || row.inspectionType === 'FULL')
                          ? (row.sampleQty ?? <span className="text-text-muted text-xs">-</span>)
                          : <span className="text-text-muted text-xs">자동</span>}
                      </td>
```

- [ ] **Step 6: structure test 작성**

Create `iqc-spec-inspection-type.structure.test.mjs` (기존 `*.structure.test.mjs` 패턴 — 소스 문자열 검사):
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./IqcSpecPanel.tsx', import.meta.url), 'utf8');

test('검사유형/샘플수 공통코드 옵션을 사용한다', () => {
  assert.match(src, /useComCodeOptions\("IQC_INSPECT_TYPE"\)/);
  assert.match(src, /useComCodeOptions\("IQC_SAMPLE_METHOD"\)/);
});
test('save body에 inspectionType/sampleMethod/sampleQty가 포함된다', () => {
  assert.match(src, /inspectionType: it\.inspectionType/);
  assert.match(src, /sampleQty: it\.sampleQty/);
});
test('파괴/전수 검사유형일 때만 샘플수 입력을 노출한다', () => {
  assert.match(src, /inspectionType === 'DESTRUCTIVE' \|\| draft\.inspectionType === 'FULL'/);
});
```

- [ ] **Step 7: 테스트 + 타입체크**

Run: `node --test apps/frontend/src/app/(authenticated)/master/iqc-item/components/iqc-spec-inspection-type.structure.test.mjs`
Expected: 3 pass.
Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0건.

- [ ] **Step 8: Commit**

```bash
git add "apps/frontend/src/app/(authenticated)/master/iqc-item/types.ts" "apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcSpecPanel.tsx" "apps/frontend/src/app/(authenticated)/master/iqc-item/components/iqc-spec-inspection-type.structure.test.mjs"
git commit -m "feat(iqc): 검사계획 화면 검사유형/샘플수 입력"
```

---

### Task 7: 검사 모달 — 파괴검사 별도 입력 영역

**Files:**
- Modify: `apps/frontend/src/components/material/IqcModal.tsx` (IqcInspectItem 15-28행, 매트릭스 분리 218-229·307-327행, 좌측폼 586행 인근, 제출 359-373행)
- Modify: `apps/frontend/src/locales/{ko,en,zh,vi}.json` (material.iqc.* 키)
- Test: `apps/frontend/src/components/material/iqc-modal-destructive.structure.test.mjs`

**Interfaces:**
- Consumes: resolve-items의 `inspectionType/sampleMethod/sampleQty`(Task 3).
- Produces: 제출 `details` JSON에 `destructive: [{seq, inspItemCode, requiredQty, inspectedQty, defectQty, result}]` 추가. AQL 시리얼 매트릭스는 AQL 항목만 사용.

- [ ] **Step 1: 타입 확장 + 검사항목 분리**

Modify `IqcModal.tsx` `IqcInspectItem`(15-28행)에 추가(`inspItemCode`는 resolve-items가 Task 3에서 반환):
```ts
  inspItemCode?: string;
  inspectionType?: string | null;
  sampleMethod?: string | null;
  sampleQty?: number | null;
```
그리고 `inspectItems`에서 AQL/파괴를 분리하는 파생값 추가(`hasInspectItems` 333행 인근):
```ts
  const aqlItems = useMemo(
    () => inspectItems.filter((it) => (it.inspectionType ?? 'AQL').toUpperCase() === 'AQL'),
    [inspectItems],
  );
  const destructItems = useMemo(
    () => inspectItems.filter((it) => ['DESTRUCTIVE', 'FULL'].includes((it.inspectionType ?? 'AQL').toUpperCase())),
    [inspectItems],
  );
```

- [ ] **Step 2: 시리얼 매트릭스를 AQL 항목으로 제한**

Modify `createMeasurementRows` 호출처(224·254·269행) — `inspectItems` → `aqlItems`로 교체. 그리고 effect 의존성 배열(229·274행)의 `inspectItems`도 `aqlItems`로 교체. (AQL 항목만 시리얼별 매트릭스 생성)

- [ ] **Step 3: 파괴검사 입력 상태 추가**

Modify — 상태 선언부(143행 인근)에 추가:
```ts
  const [destructInputs, setDestructInputs] = useState<Record<number, { inspectedQty: string; defectQty: string }>>({});
```
그리고 `destructItems` 변경 시 기본값 채우는 effect 추가:
```ts
  useEffect(() => {
    setDestructInputs((prev) => {
      const next = { ...prev };
      for (const it of destructItems) {
        if (!next[it.seq]) next[it.seq] = { inspectedQty: String(it.sampleQty ?? ''), defectQty: '0' };
      }
      return next;
    });
  }, [destructItems]);
```

- [ ] **Step 4: 파괴검사 입력 UI (좌측폼 하단에 섹션 추가)**

Modify — 좌측 입력폼 닫는 `</div>`(586행) 직전에 추가:
```tsx
            {/* 파괴/전수 검사 */}
            {destructItems.length > 0 && (
              <div className="rounded border border-border bg-background p-1.5">
                <span className="mb-1 block text-[11px] font-medium leading-none text-text-muted">
                  {t("material.iqc.destructive", "파괴/전수 검사")}
                </span>
                <div className="space-y-1">
                  {destructItems.map((it) => {
                    const v = destructInputs[it.seq] ?? { inspectedQty: '', defectQty: '0' };
                    const defectN = Number(v.defectQty) || 0;
                    return (
                      <div key={it.seq} className="grid grid-cols-[1fr_44px_44px] items-center gap-1">
                        <span className="truncate text-[11px] text-text" title={it.inspectItem}>
                          {it.inspectItem}
                          <span className="ml-1 text-text-muted">({it.sampleQty ?? '-'})</span>
                        </span>
                        <input
                          type="number" min={0} value={v.inspectedQty}
                          onChange={(e) => setDestructInputs((p) => ({ ...p, [it.seq]: { ...v, inspectedQty: e.target.value } }))}
                          className="h-7 min-w-0 rounded border border-border bg-surface px-1 text-xs text-text"
                          title={t("material.iqc.inspectedQty", "검사수량")}
                        />
                        <input
                          type="number" min={0} value={v.defectQty}
                          onChange={(e) => setDestructInputs((p) => ({ ...p, [it.seq]: { ...v, defectQty: e.target.value } }))}
                          className={`h-7 min-w-0 rounded border px-1 text-xs ${defectN > 0 ? 'border-red-400 text-red-600' : 'border-border text-text'} bg-surface`}
                          title={t("material.iqc.defectQty", "불량수")}
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1 text-[10px] text-text-muted">{t("material.iqc.destructiveHint", "검사수량 / 불량수 — 불량 1건이면 FAIL")}</p>
              </div>
            )}
```

- [ ] **Step 5: 제출 payload에 destructive + 종합 판정 반영**

Modify — `handleSerialSubmit`(359-373행) 직전에 파생값 추가:
```ts
  const destructivePayload = useMemo(() => destructItems.map((it) => {
    const v = destructInputs[it.seq] ?? { inspectedQty: '', defectQty: '0' };
    const defectQty = Number(v.defectQty) || 0;
    return {
      seq: it.seq,
      inspItemCode: it.inspItemCode ?? '',
      requiredQty: it.sampleQty ?? null,
      inspectedQty: Number(v.inspectedQty) || 0,
      defectQty,
      result: defectQty > 0 ? 'FAIL' : 'PASS',
    };
  }), [destructItems, destructInputs]);
  const anyDestructFail = destructivePayload.some((d) => d.result === 'FAIL');
```
(`it.inspItemCode`는 Task 3에서 resolve-items 반환에 추가됨 + Task 7 Step 1에서 IqcInspectItem 타입에 추가됨.)
그리고 `handleSerialSubmit` 내부: `const verdict = anyFail ? ...`를 `const verdict = (anyFail || anyDestructFail) ? "FAILED" : "PASSED";`로 변경하고, `onSubmit` 첫 인자에 `destructive: destructivePayload` 추가:
```ts
    onSubmit({
      type: "SERIAL_INSPECTION",
      serials: serialInspectionPayload,
      destructive: destructivePayload,
    }, verdict, { ... });
```
의존성 배열에 `anyDestructFail, destructivePayload` 추가.

- [ ] **Step 6: canSubmit 보정**

Modify — `canSubmit`(339행): AQL 항목이 없고 파괴검사만 있는 품목도 제출 가능하도록:
```ts
  const canSubmit = (scannedSerials.length > 0 || (aqlItems.length === 0 && destructItems.length > 0)) && !loadingItems && !isIncomplete;
```

- [ ] **Step 7: i18n 4파일 키 추가**

Modify `locales/{ko,en,zh,vi}.json` — `material.iqc` 객체에 추가(각 언어 번역):
- `destructive`: 파괴/전수 검사 / Destructive/Full / 破坏/全数检验 / Kiểm tra phá hủy/toàn bộ
- `inspectedQty`: 검사수량 / Inspected / 检验数 / Số kiểm
- `defectQty`: 불량수 / Defects / 不良数 / Số lỗi
- `destructiveHint`: 검사수량 / 불량수 — 불량 1건이면 FAIL (각 언어)

Run(검증): `node -e "['ko','en','zh','vi'].forEach(l=>JSON.parse(require('fs').readFileSync('apps/frontend/src/locales/'+l+'.json')))"` → 에러 없음(BOM/구문 정상).

- [ ] **Step 8: structure test 작성**

Create `iqc-modal-destructive.structure.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('./IqcModal.tsx', import.meta.url), 'utf8');

test('AQL 항목과 파괴검사 항목을 분리한다', () => {
  assert.match(src, /const aqlItems = useMemo/);
  assert.match(src, /const destructItems = useMemo/);
});
test('시리얼 매트릭스는 aqlItems로 생성한다', () => {
  assert.doesNotMatch(src, /createMeasurementRows\(inspectItems\)/);
  assert.match(src, /createMeasurementRows\(aqlItems\)/);
});
test('제출 payload에 destructive를 포함한다', () => {
  assert.match(src, /destructive: destructivePayload/);
});
```

- [ ] **Step 9: 테스트 + 타입체크**

Run: `node --test apps/frontend/src/components/material/iqc-modal-destructive.structure.test.mjs` → pass
Run: `pnpm --filter @harness/frontend exec tsc --noEmit` → 0건

- [ ] **Step 10: Commit**

```bash
git add apps/frontend/src/components/material/IqcModal.tsx apps/frontend/src/components/material/iqc-modal-destructive.structure.test.mjs apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json
git commit -m "feat(iqc): 검사 모달 파괴/전수 검사 입력 영역"
```

---

### Task 8: 이력 표시 + 통합 검증 시드

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/material/iqc-history/IqcDetailModal.tsx` (ItemJudgeEntry 10-21행, 표 134-164행)
- Create: `tools/seed/seed_iqc_destructive_example.py`

**Interfaces:**
- Consumes: itemResults의 `inspectionType/requiredQty/inspectedQty`(Task 4).
- Produces: 이력 상세에 검사유형·요구/검사수량 컬럼. 검증용 예시 품목 1개(파괴검사 항목 포함).

- [ ] **Step 1: ItemJudgeEntry 타입 확장**

Modify `IqcDetailModal.tsx` `ItemJudgeEntry`(10-21행)에 추가:
```ts
  inspectionType?: string;
  requiredQty?: number | null;
  inspectedQty?: number | null;
```

- [ ] **Step 2: 검사항목별 판정 표에 검사유형/검사수량 컬럼 추가**

Modify — `검사항목별 판정` 표 헤더(136-144행) `불량등급` `<th>` 다음에 추가:
```tsx
                      <th className="text-center px-2 py-1.5 font-medium text-text-muted">검사유형</th>
                      <th className="text-center px-2 py-1.5 font-medium text-text-muted">요구/검사</th>
```
그리고 표 본문(149-160행) `불량등급` `<td>` 다음에 추가:
```tsx
                        <td className="px-2 py-1.5 text-center">
                          {r.inspectionType && r.inspectionType !== 'AQL'
                            ? <ComCodeBadge groupCode="IQC_INSPECT_TYPE" code={r.inspectionType} />
                            : <span className="text-text-muted">AQL</span>}
                        </td>
                        <td className="px-2 py-1.5 text-center tabular-nums text-text-muted">
                          {r.requiredQty != null ? `${r.inspectedQty ?? '-'}/${r.requiredQty}` : '-'}
                        </td>
```

- [ ] **Step 3: 검증용 시드 작성**

Create `tools/seed/seed_iqc_destructive_example.py` — 기존 품목 1개(예: CBL-A)의 IQC 항목에 파괴검사 1건 추가(인장 IQC-PULL, DESTRUCTIVE/FIXED/5, MAJOR). `seed_iqc_aql_link.py` 연결 패턴 재사용. UPDATE/INSERT는 IQC_PART_SPEC_ITEMS에 직접:
```python
# IQC-PULL 항목이 풀에 있는지 확인 후, 대상 품목 spec에 seq 추가
# INSPECTION_TYPE='DESTRUCTIVE', SAMPLE_METHOD='FIXED', SAMPLE_QTY=5, DEFECT_GRADE='MAJOR'
```
(실제 컬럼/풀 코드 존재 여부는 실측 후 작성. dry-run → --commit 멱등 처리.)

- [ ] **Step 4: 시드 dry-run → commit**

Run: `python tools/seed/seed_iqc_destructive_example.py` → DRY-RUN 정상
Run: `python tools/seed/seed_iqc_destructive_example.py --commit` → COMMITTED

- [ ] **Step 5: structure test (이력 표시)**

Create `apps/frontend/src/app/(authenticated)/material/iqc-history/iqc-detail-inspection-type.structure.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('./IqcDetailModal.tsx', import.meta.url), 'utf8');
test('검사유형/검사수량 컬럼을 표시한다', () => {
  assert.match(src, /IQC_INSPECT_TYPE/);
  assert.match(src, /requiredQty/);
});
```
Run: `node --test .../iqc-detail-inspection-type.structure.test.mjs` → pass

- [ ] **Step 6: 통합 검증 (BE 빌드 + 타입체크)**

> 사용자 dev 서버 실행 중이면 `pnpm build` 금지. 타입체크만:
Run: `pnpm --filter @harness/backend exec tsc --noEmit` → 0건
Run: `pnpm --filter @harness/frontend exec tsc --noEmit` → 0건
Run: `pnpm --filter @harness/backend exec jest aql.service.spec iqc-history.service.spec iqc-part-spec.service.spec` → 전부 PASS

- [ ] **Step 7: Commit**

```bash
git add "apps/frontend/src/app/(authenticated)/material/iqc-history/IqcDetailModal.tsx" "apps/frontend/src/app/(authenticated)/material/iqc-history/iqc-detail-inspection-type.structure.test.mjs" tools/seed/seed_iqc_destructive_example.py
git commit -m "feat(iqc): 이력 검사유형 표시 + 파괴검사 검증 시드"
```

---

## 구현 후 검증 체크리스트

- [ ] DB: `IQC_PART_SPEC_ITEMS`에 3컬럼 존재, INVALID PL/SQL 0건
- [ ] 공통코드: `IQC_INSPECT_TYPE`/`IQC_SAMPLE_METHOD` 조회됨
- [ ] 판정: 파괴검사 불량 1건 → 항목 FAIL → LOT FAIL (jest 통과)
- [ ] 폴백: 검사유형/등급 미설정 품목은 기존 동작 그대로 (기존 jest 통과)
- [ ] i18n: ko/en/zh/vi 4파일 동기화, BOM 없음
- [ ] 빌드/타입체크: BE·FE tsc 에러 0건
- [ ] 화면: 검사계획에 검사유형/샘플수 입력 → 검사 모달에 파괴검사 영역 → 이력에 검사유형 표시
