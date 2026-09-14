# 불용창고(UNUSABLE) 분리 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 불용창고(`WH-DEFECT`)를 새 창고유형 `UNUSABLE`로 올려 원자재 불량창고(`DEFECT`)와 시스템 수준에서 분리하고, 반제품·완제품 불량의 목적지를 불용창고로 옮긴다.

**Architecture:** 창고유형을 분리하면 화면 필터가 자동으로 갈려 오선택이 구조적으로 불가능해진다. 목적지 창고 해석은 새 함수를 만들지 않고 **이미 존재하는 `WarehouseService.getDefaultWarehouse(type)`**(`warehouse.service.ts:169`)를 단일 출처로 쓴다. 소비처 3곳(제품 불량입고·재작업·수리)이 모두 그것을 본다.

**Tech Stack:** NestJS + TypeORM(Oracle) / Next.js + react-i18next / pnpm 모노레포 / jest

**설계 문서:** `docs/specs/2026-09-14-unusable-warehouse-separation-design.md`

---

## 사전 확인 (구현 시작 전 반드시 읽을 것)

1. **`packages/shared` 편집 후에는 반드시 재빌드한다.** 앱 tsconfig가 `dist`를 해석하므로
   재빌드 없이는 FE/BE 타입체크가 새 값을 보지 못한다. Task 1이 이걸 다룬다.
2. **DB 마이그레이션(Task 3)은 코드 배포와 같은 창에서 한다.** JSHANES DB는
   `hswbs.haengsung.com:3002` 배포 서버와 공유된다. Task 3을 먼저 적용하고 코드를 안 올리면
   구 코드가 마이그레이션된 DB를 읽는다. **Task 1~2, 4~10을 먼저 끝내고 Task 3을 마지막 직전에** 적용한다.
3. i18n은 **ko·en·zh·vi 4개 파일을 동시에** 고친다. JSON에 UTF-8 BOM을 넣지 않는다(Turbopack 빌드 실패).
4. dev 서버가 떠 있으면 `pnpm build` 대신 `pnpm run typecheck:backend` / `typecheck:frontend`를 쓴다.

---

## File Structure

| 파일 | 책임 | 작업 |
|---|---|---|
| `packages/shared/src/constants/com-code-values.ts:318` | 창고유형 값 목록 (DTO 검증 출처) | 수정 |
| `apps/backend/src/modules/inventory/services/warehouse.service.ts:169,244-254` | 기본창고 해석기 · 초기 창고 시드 | 수정 |
| `apps/backend/src/modules/inventory/services/product-inventory.service.ts:607-640` | 제품 불량입고 목적지 | 수정 |
| `apps/backend/src/modules/quality/rework/services/rework.service.ts:535-595` | 재작업 합격/폐기 재고 이동 출발지 | 수정 |
| `apps/backend/src/modules/production/services/repair-stock.service.ts:39` | 수리 인수 허용 창고유형 | 수정 |
| `apps/backend/src/modules/material/services/iqc-history.service.ts:832` | IQC 불합격 자동이동 목적지 | 수정 |
| `apps/backend/src/modules/material/services/shelf-life-reinspect.service.ts:233` | 유효기간 재검사 불합격 목적지 | 수정 |
| `apps/backend/src/modules/ai-page-tools/registry/warehouse-master.tools.ts:3-6` | AI 도구 창고유형 목록·프롬프트 | 수정 |
| `apps/backend/src/modules/ai-page-tools/registry/warehouse-tools.provider.ts:8` | AI 도구 창고유형 검증 | 수정 |
| `apps/frontend/src/app/(authenticated)/product/defect-transfer/page.tsx` | 입고 창고 표시 | 수정 |
| `apps/frontend/src/app/(authenticated)/inventory/stock/page.tsx:25-32` | 재고 화면 창고유형 필터 | 수정 |
| `apps/frontend/src/app/(authenticated)/master/warehouse/types.ts:28-33` | 창고유형 배지 색 | 수정 |
| `apps/frontend/src/locales/{ko,en,zh,vi}/translation.json` | 라벨 4종 | 수정 |
| `scripts/2026-09-14_unusable_warehouse.sql` | DB 마이그레이션 | 생성 |
| `scripts/migration/77_thn_gap_phase1_columns.sql:22` | 신규 DB 프로비저닝 | 수정 |

---

## Task 1: shared 상수에 UNUSABLE 추가하고 재빌드

**Files:**
- Modify: `packages/shared/src/constants/com-code-values.ts:318`

- [ ] **Step 1: 상수에 값 추가**

```ts
export const WAREHOUSE_TYPE_DTO_VALUES = ['RAW', 'WIP', 'FG', 'FLOOR', 'DEFECT', 'UNUSABLE', 'SCRAP', 'SUBCON'] as const;
```

- [ ] **Step 2: shared 재빌드**

Run: `pnpm --filter @harness/shared build`
Expected: 에러 없이 종료. `packages/shared/dist/constants/com-code-values.js`에 `UNUSABLE`이 보여야 한다.

확인: `grep -c UNUSABLE packages/shared/dist/constants/com-code-values.js` → `1` 이상

- [ ] **Step 3: 양쪽 타입체크**

Run: `pnpm run typecheck:backend && pnpm run typecheck:frontend`
Expected: EXIT 0

- [ ] **Step 4: 커밋**

```bash
git add packages/shared/src/constants/com-code-values.ts
git commit -m "feat(shared): 창고유형에 UNUSABLE(불용) 값을 추가한다"
```

---

## Task 2: 공통코드와 i18n 라벨 추가

**Files:**
- Create: `scripts/2026-09-14_unusable_warehouse_comcode.sql`
- Modify: `apps/frontend/src/locales/{ko,en,zh,vi}/translation.json`

- [ ] **Step 1: 공통코드 MERGE SQL 작성**

기존 `WAREHOUSE_TYPE_DTO` 정렬값은 RAW=1, WIP=2, FG=3, FLOOR=4, DEFECT=5, SCRAP=6, SUBCON=7 이다.
`UNUSABLE`은 DEFECT 바로 뒤가 자연스러우나 기존 값을 밀지 않도록 **8**을 쓴다.

```sql
MERGE INTO COM_CODES t
USING (SELECT 'WAREHOUSE_TYPE_DTO' GROUP_CODE, 'UNUSABLE' DETAIL_CODE, '40' COMPANY, '1000' PLANT_CD FROM DUAL) s
ON (t.GROUP_CODE = s.GROUP_CODE AND t.DETAIL_CODE = s.DETAIL_CODE AND t.COMPANY = s.COMPANY AND t.PLANT_CD = s.PLANT_CD)
WHEN NOT MATCHED THEN INSERT (GROUP_CODE, DETAIL_CODE, CODE_NAME, CODE_DESC, SORT_ORDER, USE_YN, COMPANY, PLANT_CD, CREATED_BY, UPDATED_BY)
VALUES ('WAREHOUSE_TYPE_DTO', 'UNUSABLE', '불용', '반제품·완제품 불량 보관 창고', 8, 'Y', '40', '1000', 'unusable-wh', 'unusable-wh');
/
COMMIT;
/
```

- [ ] **Step 2: 적용 전 현재 코드 확인**

Run:
```bash
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT DETAIL_CODE, CODE_NAME, SORT_ORDER FROM COM_CODES WHERE GROUP_CODE='WAREHOUSE_TYPE_DTO' AND COMPANY='40' ORDER BY SORT_ORDER"
```
Expected: 7행 (RAW/WIP/FG/FLOOR/DEFECT/SCRAP/SUBCON)

- [ ] **Step 3: 적용**

Run: `python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file scripts/2026-09-14_unusable_warehouse_comcode.sql`
Expected: 성공. Step 2 쿼리 재실행 시 8행, `UNUSABLE/불용/8` 포함

- [ ] **Step 4: i18n 4개 파일에 라벨 추가**

`comCode.WAREHOUSE_TYPE_DTO.UNUSABLE` 키를 4개 파일에 넣는다. 기존 `DEFECT` 키가 있는
같은 블록에 나란히 둔다. 값: ko `불용`, en `Unusable`, zh `不可用`, vi `Không sử dụng được`.

같은 작업에서 아래 키도 함께 넣는다(Task 9·10에서 쓴다).
- `inventory.stock.unusable` — ko `불용창고`, en `Unusable`, zh `不可用仓库`, vi `Kho không sử dụng được`
- `productMgmt.defectTransfer.targetWarehouse` — ko `입고 창고: 불용창고`, en `Destination: Unusable warehouse`, zh `入库仓库：不可用仓库`, vi `Kho nhập: Kho không sử dụng được`

- [ ] **Step 5: 4개 파일에 키가 다 들어갔는지 검증**

Run: `grep -c "UNUSABLE\|unusable\|targetWarehouse" apps/frontend/src/locales/ko/translation.json apps/frontend/src/locales/en/translation.json apps/frontend/src/locales/zh/translation.json apps/frontend/src/locales/vi/translation.json`
Expected: 4개 파일 모두 같은 개수

BOM 검증 Run: `file apps/frontend/src/locales/*/translation.json`
Expected: 어느 파일도 "with BOM"이 아니어야 한다

- [ ] **Step 6: 커밋**

```bash
git add scripts/2026-09-14_unusable_warehouse_comcode.sql apps/frontend/src/locales/ko/translation.json apps/frontend/src/locales/en/translation.json apps/frontend/src/locales/zh/translation.json apps/frontend/src/locales/vi/translation.json
git commit -m "feat(i18n): 불용창고 창고유형 공통코드와 4개 언어 라벨을 추가한다"
```

---

## Task 3: DB 마이그레이션 — WH-DEFECT를 UNUSABLE로 (⚠ 배포와 같은 창에서)

> **이 Task는 Task 4~10을 모두 끝내고 배포 직전에 적용한다.** 먼저 적용하면 배포 서버의 구 코드가
> 마이그레이션된 DB를 읽는다. SQL 파일 작성까지는 지금 해도 된다.

**Files:**
- Create: `scripts/2026-09-14_unusable_warehouse.sql`

- [ ] **Step 1: 적용 전 상태 기록**

Run:
```bash
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT WAREHOUSE_CODE, WAREHOUSE_TYPE, IS_DEFAULT, USE_YN FROM WAREHOUSES WHERE COMPANY='40' AND WAREHOUSE_TYPE IN ('DEFECT','UNUSABLE')"
```
Expected: `DEFECT/DEFECT/Y/Y`, `WH-DEFECT/DEFECT/N/Y` 2행

재고 0건 재확인 Run:
```bash
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT (SELECT COUNT(*) FROM MAT_STOCKS WHERE WAREHOUSE_CODE='WH-DEFECT') M, (SELECT COUNT(*) FROM PRODUCT_STOCKS WHERE WAREHOUSE_CODE='WH-DEFECT') P FROM DUAL"
```
Expected: `M=0, P=0`. **0이 아니면 중단하고 사람에게 알린다.**

- [ ] **Step 2: 마이그레이션 SQL 작성**

```sql
UPDATE WAREHOUSES
   SET WAREHOUSE_TYPE = 'UNUSABLE',
       IS_DEFAULT = 'Y',
       UPDATED_BY = 'unusable-wh',
       UPDATED_AT = SYSTIMESTAMP
 WHERE WAREHOUSE_CODE = 'WH-DEFECT'
   AND COMPANY = '40'
   AND WAREHOUSE_TYPE = 'DEFECT';
/
COMMIT;
/
```

- [ ] **Step 3: 적용**

Run: `python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file scripts/2026-09-14_unusable_warehouse.sql`
Expected: 1행 갱신

- [ ] **Step 4: 적용 후 확인**

Step 1의 첫 쿼리를 다시 실행.
Expected: `DEFECT/DEFECT/Y/Y`, `WH-DEFECT/UNUSABLE/Y/Y`

- [ ] **Step 5: 커밋**

```bash
git add scripts/2026-09-14_unusable_warehouse.sql
git commit -m "chore(db): 불용창고를 UNUSABLE 유형으로 전환하는 마이그레이션"
```

---

## Task 4: 신규 테넌트에도 불용창고가 생기게 한다

**Files:**
- Modify: `apps/backend/src/modules/inventory/services/warehouse.service.ts:244-254`
- Modify: `scripts/migration/77_thn_gap_phase1_columns.sql:22`
- Test: `apps/backend/src/modules/inventory/services/warehouse.service.spec.ts` (없으면 생성)

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it('initDefaultWarehouses 가 불용창고를 UNUSABLE 유형 기본창고로 포함한다', async () => {
  mockWarehouseRepo.findOne.mockResolvedValue(null);
  mockWarehouseRepo.create.mockImplementation((v) => v as Warehouse);
  mockWarehouseRepo.save.mockImplementation((v) => Promise.resolve(v as Warehouse));

  await target.initDefaultWarehouses('40', '1000');

  const saved = mockWarehouseRepo.save.mock.calls.map(([v]) => v as Warehouse);
  const unusable = saved.find((w) => w.warehouseCode === 'WH-DEFECT');
  expect(unusable).toBeDefined();
  expect(unusable?.warehouseType).toBe('UNUSABLE');
  expect(unusable?.isDefault).toBe('Y');
});
```

> 기존 spec 파일이 없으면 같은 모듈의 다른 spec(예: `consumable.service.spec.ts`)의
> `Test.createTestingModule` 구성을 본떠 만든다. `WarehouseService` 생성자 인자를 실제로 확인하고
> 모든 의존성에 `createMock`을 넣는다 — 하나라도 빠지면 `Nest can't resolve dependencies`로 깨진다.

- [ ] **Step 2: 실패 확인**

Run: `pnpm --dir apps/backend run test:ci src/modules/inventory/services/warehouse.service.spec.ts`
Expected: FAIL — `unusable` 이 undefined

- [ ] **Step 3: 구현**

`warehouse.service.ts`의 `defaultWarehouses` 배열에서 `DEFECT` 줄 바로 아래에 추가:

```ts
      { code: 'WH-DEFECT', name: '불용창고', type: 'UNUSABLE', isDefault: true },
```

- [ ] **Step 4: 통과 확인**

Run: 같은 명령
Expected: PASS

- [ ] **Step 5: 프로비저닝 스크립트도 고친다**

`scripts/migration/77_thn_gap_phase1_columns.sql:22`에서 `WH-DEFECT`를 생성할 때의
`WAREHOUSE_TYPE`을 `'DEFECT'` → `'UNUSABLE'`로 바꾼다. `:24`의 `NOT EXISTS` 가드가 있어
기존 DB 재실행은 무해하다.

- [ ] **Step 6: 커밋**

```bash
git add apps/backend/src/modules/inventory/services/warehouse.service.ts apps/backend/src/modules/inventory/services/warehouse.service.spec.ts scripts/migration/77_thn_gap_phase1_columns.sql
git commit -m "fix(inventory): 신규 테넌트 기본창고에 불용창고를 포함한다"
```

---

## Task 5: 제품 불량입고 목적지를 UNUSABLE 기준으로 전환

**Files:**
- Modify: `apps/backend/src/modules/inventory/services/product-inventory.service.ts:607-640`
- Test: `apps/backend/src/modules/inventory/services/product-inventory.service.spec.ts:555-590`

현재 구조는 `dto.toWarehouseId || 'DEFECT'`로 코드를 먼저 정하고 코드로 조회하므로,
`:623`의 유형 폴백(`warehouseType:'DEFECT', isDefault:'Y'`)은 **도달 불가능한 죽은 코드**다.
이 구조를 걷어내고 유형 조회를 1순위로 만든다.

- [ ] **Step 1: 기존 테스트를 새 계약으로 고쳐 실패시킨다**

`product-inventory.service.spec.ts:562-564`의 단언을 바꾼다:

```ts
    expect(qrManagerFindOne).toHaveBeenNthCalledWith(1, Warehouse, {
      where: { warehouseType: 'UNUSABLE', isDefault: 'Y', useYn: 'Y', company: '40', plant: '1000' },
    });
```

`:569`·`:581`의 `'DEFECT'` 기대값도 `'WH-DEFECT'`로 바꾼다.

- [ ] **Step 2: 실패 확인**

Run: `pnpm --dir apps/backend run test:ci src/modules/inventory/services/product-inventory.service.spec.ts`
Expected: FAIL — 1번째 호출이 `warehouseCode:'DEFECT'` 조회다

- [ ] **Step 3: 구현**

`transferDefectStockToWarehouse`의 창고 해석부를 교체한다.

```ts
    const tenantWhere = this.tenantWhere(dto.company, dto.plant);

    return this.tx.run(async (qr) => {
      // 목적지 불용창고는 유형으로 찾는다 — 창고코드에 의존하지 않는다.
      // 호출자가 창고를 지정했으면 그것을 쓰되, 유형 검증은 아래에서 동일하게 건다.
      const defectWarehouse = dto.toWarehouseId
        ? await qr.manager.findOne(Warehouse, { where: { warehouseCode: dto.toWarehouseId, ...tenantWhere } })
        : await qr.manager.findOne(Warehouse, { where: { warehouseType: 'UNUSABLE', isDefault: 'Y', useYn: 'Y', ...tenantWhere } });

      if (!defectWarehouse) {
        throw new BadRequestException('불용창고가 설정되어 있지 않습니다.');
      }
      if (defectWarehouse.warehouseType !== 'UNUSABLE') {
        throw new BadRequestException('도착 창고는 불용창고여야 합니다.');
      }
```

`itemType` 계산 줄은 그대로 두고, 아래 `issueStockInTx` 호출의 `toWarehouseId`가
`defectWarehouse.warehouseCode`를 쓰는지 확인한다.

- [ ] **Step 4: 통과 확인**

Run: 같은 명령
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/src/modules/inventory/services/product-inventory.service.ts apps/backend/src/modules/inventory/services/product-inventory.service.spec.ts
git commit -m "feat(inventory): 제품 불량입고 목적지를 불용창고(UNUSABLE)로 전환한다"
```

---

## Task 6: 재작업 출발지 교정 + 보충 폴백 제거

**Files:**
- Modify: `apps/backend/src/modules/quality/rework/services/rework.service.ts:535-595`
- Test: `apps/backend/src/modules/quality/rework/services/rework.policy.spec.ts`

설계 §1-1의 기존 결함을 함께 고친다. `fromWarehouseId: 'DEFECT'`는 지금도 틀렸다 —
생산 불량은 `FG_WIP`/`SFG_WIP`에 `qualityStatus='DEFECT'`로 적재된다.

**주의:** `WarehouseService`를 주입하면 생성자 인자가 하나 늘어난다.
`rework.policy.spec.ts`의 `providers` 배열에 반드시 함께 추가해야 한다
(빠뜨리면 `Nest can't resolve dependencies`로 깨진다 — 이 spec은 같은 이유로 이미 한 번 깨진 적이 있다).

- [ ] **Step 1: 실패하는 테스트 2개 작성**

```ts
it('재작업 합격분을 불용창고에서 공정창고로 이동한다', async () => {
  mockWarehouseService.getDefaultWarehouse.mockResolvedValue({ warehouseCode: 'WH-DEFECT' } as Warehouse);
  mockProductInventoryService.transferStockByItemInTx.mockResolvedValue(5);
  // ... 재작업 검사 PASS 5개 입력

  expect(mockProductInventoryService.transferStockByItemInTx).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ fromWarehouseId: 'WH-DEFECT', toWarehouseId: 'SFG_WIP' }),
  );
});

it('불용창고 재고가 부족하면 신규 입고로 보충하지 않고 실패한다', async () => {
  mockWarehouseService.getDefaultWarehouse.mockResolvedValue({ warehouseCode: 'WH-DEFECT' } as Warehouse);
  mockProductInventoryService.transferStockByItemInTx.mockResolvedValue(2); // 5 요청, 2만 이동

  await expect(/* 재작업 검사 PASS 5개 */).rejects.toThrow(/재고가 부족/);
  expect(mockProductInventoryService.receiveStockInTx).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --dir apps/backend run test:ci src/modules/quality/rework/services/rework.policy.spec.ts`
Expected: FAIL

- [ ] **Step 3: 구현 — 출발지 해석**

생성자에 `private readonly warehouseService: WarehouseService,`를 추가하고,
`:537` 주석을 실제 동작에 맞게 고친 뒤 출발지를 해석기로 바꾼다.

```ts
      const unusable = await this.warehouseService.getDefaultWarehouse('UNUSABLE', company, plant);
      if (!unusable) {
        throw new BadRequestException('불용창고가 설정되어 있지 않습니다.');
      }
```

`:549`와 `:581`의 `fromWarehouseId: 'DEFECT'`를 `fromWarehouseId: unusable.warehouseCode`로 바꾼다.

- [ ] **Step 4: 구현 — 보충 폴백 제거**

`:562-576`의 `if (moved < dto.passQty) { await ...receiveStockInTx(...) }` 블록을 통째로 지우고
다음으로 바꾼다.

```ts
        if (moved < dto.passQty) {
          throw new BadRequestException(
            `불용창고 재고가 부족합니다. 요청 ${dto.passQty}, 이동 가능 ${moved}. 불량 재고를 먼저 불용창고에 입고해 주세요.`,
          );
        }
```

- [ ] **Step 5: spec providers 갱신**

`rework.policy.spec.ts`의 `providers` 배열에 추가:

```ts
        { provide: WarehouseService, useValue: createMock<WarehouseService>() },
```

- [ ] **Step 6: 통과 확인**

Run: 같은 명령
Expected: PASS (신규 2건 포함 전부)

- [ ] **Step 7: 커밋**

```bash
git add apps/backend/src/modules/quality/rework/services/rework.service.ts apps/backend/src/modules/quality/rework/services/rework.policy.spec.ts
git commit -m "fix(rework): 재작업 재고 출발지를 불용창고로 바로잡고 보충 폴백을 제거한다"
```

---

## Task 7: 수리 인수 허용 창고유형에 UNUSABLE 추가

**Files:**
- Modify: `apps/backend/src/modules/production/services/repair-stock.service.ts:39`
- Test: `apps/backend/src/modules/production/services/repair-stock.service.spec.ts` (없으면 생성)

`repair-lookup.service.ts:25`가 창고유형 필터 없이 `qualityStatus:'DEFECT'`로만 대상을 뽑으므로,
추가하지 않으면 **수리 화면 목록에는 뜨는데 시작은 거부되는** 상태가 된다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it('불용창고 재고로 수리를 시작할 수 있다', async () => {
  mockQr.manager.findOne.mockResolvedValueOnce({ warehouseCode: 'WH-DEFECT', warehouseType: 'UNUSABLE', useYn: 'Y' });
  await expect(target.start(mockQr, order, 'WH-DEFECT')).resolves.not.toThrow();
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --dir apps/backend run test:ci src/modules/production/services/repair-stock.service.spec.ts`
Expected: FAIL — `처리 가능한 사용 중 창고가 아닙니다: WH-DEFECT`

- [ ] **Step 3: 구현**

```ts
    await this.activeWarehouse(qr, order, warehouseCode, ['WIP', 'FG', 'DEFECT', 'UNUSABLE']);
```

- [ ] **Step 4: 통과 확인 후 커밋**

```bash
git add apps/backend/src/modules/production/services/repair-stock.service.ts apps/backend/src/modules/production/services/repair-stock.service.spec.ts
git commit -m "fix(repair): 불용창고 재고로도 수리를 인수할 수 있게 한다"
```

---

## Task 8: 자동이동 목적지를 기본창고로 확정

**Files:**
- Modify: `apps/backend/src/modules/material/services/iqc-history.service.ts:832`
- Modify: `apps/backend/src/modules/material/services/shelf-life-reinspect.service.ts:233`
- Test: `apps/backend/src/modules/material/services/iqc-history.service.spec.ts:936`

두 곳이 정렬 없이 `findOne`으로 DEFECT 타입 한 건을 집는다. 원자재용이므로 `DEFECT`를 유지하되
`isDefault:'Y'`를 더해 목적지를 확정한다.

- [ ] **Step 1: 기존 단언을 새 계약으로 고쳐 실패시킨다**

`iqc-history.service.spec.ts:936`:

```ts
      where: { warehouseType: 'DEFECT', useYn: 'Y', isDefault: 'Y', company: '40', plant: '1000' },
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --dir apps/backend run test:ci src/modules/material/services/iqc-history.service.spec.ts`
Expected: FAIL

- [ ] **Step 3: 구현 — 두 파일 모두**

각 `findOne`의 `where`에 `isDefault: 'Y',`를 추가한다. `shelf-life-reinspect.service.ts:233`도
같은 수정을 한다(해당 spec은 반환값 mock이라 깨지지 않는다).

- [ ] **Step 4: 통과 확인**

Run: `pnpm --dir apps/backend run test:ci src/modules/material/services/iqc-history.service.spec.ts src/modules/material/services/shelf-life-reinspect.service.spec.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/src/modules/material/services/iqc-history.service.ts apps/backend/src/modules/material/services/shelf-life-reinspect.service.ts apps/backend/src/modules/material/services/iqc-history.service.spec.ts
git commit -m "fix(material): 불합격 자동이동 목적지를 기본 불량창고로 확정한다"
```

---

## Task 9: AI 도구 창고유형 목록 3곳

**Files:**
- Modify: `apps/backend/src/modules/ai-page-tools/registry/warehouse-master.tools.ts:3-6`
- Modify: `apps/backend/src/modules/ai-page-tools/registry/warehouse-tools.provider.ts:8`

- [ ] **Step 1: 배열 2곳에 값 추가**

두 파일의 `WH_TYPES` / `WAREHOUSE_TYPES` 배열에 `'UNUSABLE'`을 `'DEFECT'` 뒤에 넣는다.
후자는 `:61` `normalizeWhType`이 실제 검증에 쓴다.

- [ ] **Step 2: 프롬프트 문자열도 고친다**

`warehouse-master.tools.ts:4-6`의 `WH_TYPE_HINT`는 유형을 한글 매핑과 함께 나열한
**프롬프트 문자열**이다. 여기에 `UNUSABLE=불용`을 넣지 않으면 AI 도구가 "불용"을 매핑하지 못한다.

- [ ] **Step 3: 타입체크 후 커밋**

Run: `pnpm run typecheck:backend`

```bash
git add apps/backend/src/modules/ai-page-tools/registry/warehouse-master.tools.ts apps/backend/src/modules/ai-page-tools/registry/warehouse-tools.provider.ts
git commit -m "feat(ai-tools): 창고유형 목록과 프롬프트에 불용을 추가한다"
```

---

## Task 10: 프론트 3곳

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/product/defect-transfer/page.tsx`
- Modify: `apps/frontend/src/app/(authenticated)/inventory/stock/page.tsx:25-32`
- Modify: `apps/frontend/src/app/(authenticated)/master/warehouse/types.ts:28-33`

- [ ] **Step 1: 제품 불량입고 화면에 목적지 표시**

"입고 대상 불량 재고" 제목이 있는 헤더 영역(`targetTitle` 근처)에 목적지를 드러낸다.

```tsx
<span className="text-xs text-text-muted">
  {t("productMgmt.defectTransfer.targetWarehouse", "입고 창고: 불용창고")}
</span>
```

배경색 배지를 쓰지 않는다 — 이 프로젝트는 카드/배지 파스텔 배경을 금지한다. 텍스트로만 구분한다.

- [ ] **Step 2: 재고 화면 필터에 불용 추가**

`inventory/stock/page.tsx`의 `WAREHOUSE_TYPES` 배열에서 `DEFECT` 줄 아래에 넣는다:

```tsx
    { value: 'UNUSABLE', label: t('inventory.stock.unusable') },
```

- [ ] **Step 3: 배지 색 지정**

`master/warehouse/types.ts`의 `WAREHOUSE_TYPE_COLORS`에 `DEFECT` 줄 아래 추가.
기존 항목들과 같은 형식을 따른다(이 맵은 기존 관행이므로 형식을 바꾸지 않는다):

```ts
  UNUSABLE: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
```

- [ ] **Step 4: 타입체크 후 커밋**

Run: `pnpm run typecheck:frontend`

```bash
git add "apps/frontend/src/app/(authenticated)/product/defect-transfer/page.tsx" "apps/frontend/src/app/(authenticated)/inventory/stock/page.tsx" "apps/frontend/src/app/(authenticated)/master/warehouse/types.ts"
git commit -m "feat(product): 제품 불량입고 목적지를 화면에 드러내고 불용창고 필터를 추가한다"
```

---

## Task 11: 전체 검증

- [ ] **Step 1: 백엔드 전량 테스트**

Run: `pnpm run test:backend:ci`
Expected: 228+ suites 전량 통과, 실패 0

- [ ] **Step 2: 양쪽 타입체크**

Run: `pnpm run typecheck:backend && pnpm run typecheck:frontend`
Expected: EXIT 0

- [ ] **Step 3: Task 3(DB 마이그레이션)을 아직 안 했다면 지금 적용**

Task 3의 Step 1~4를 수행한다.

- [ ] **Step 4: 실화면 검증 — IQC 불합격 입고**

`http://localhost:3002/material/iqc-defect-receive` 접속.
- 불량창고 드롭다운에 **불용창고가 없어야 한다** (이게 원래 질문의 해결 확인)
- 자재 1건을 입고하고 `MAT_STOCKS.WAREHOUSE_CODE='DEFECT'`로 들어갔는지 DB로 확인

- [ ] **Step 5: 실화면 검증 — 제품 불량입고**

`http://localhost:3002/product/defect-transfer` 접속.
- 화면에 "입고 창고: 불용창고" 표시가 보여야 한다
- 공정 WIP 불량 1건을 입고하고 `PRODUCT_STOCKS.WAREHOUSE_CODE='WH-DEFECT'` 확인

Run:
```bash
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT WAREHOUSE_CODE, ITEM_TYPE, QUALITY_STATUS, QTY FROM PRODUCT_STOCKS WHERE WAREHOUSE_CODE='WH-DEFECT' AND COMPANY='40'"
```

- [ ] **Step 6: 이동 이력 대조**

Run:
```bash
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT TRANS_TYPE, FROM_WAREHOUSE_ID, TO_WAREHOUSE_ID, QTY FROM PRODUCT_TRANSACTIONS WHERE TO_WAREHOUSE_ID='WH-DEFECT' AND COMPANY='40' ORDER BY CREATED_AT DESC FETCH FIRST 5 ROWS ONLY"
```
Expected: Step 5에서 넣은 건이 보인다

- [ ] **Step 7: 미완료 기록 또는 완료 보고**

검증 중 끝내지 못한 항목이 있으면 `docs/standards/unfinished-work-record.md` 기준으로
`docs/reports/unfinished-work/`에 기록한다.

---

## 롤백

Task 3만 되돌리면 기능은 원래대로 돌아간다(코드는 `UNUSABLE` 창고를 못 찾아 제품 불량입고가
막히지만, 잘못된 창고로 들어가지는 않는다).

```sql
UPDATE WAREHOUSES SET WAREHOUSE_TYPE='DEFECT', IS_DEFAULT='N' WHERE WAREHOUSE_CODE='WH-DEFECT' AND COMPANY='40';
COMMIT;
```
