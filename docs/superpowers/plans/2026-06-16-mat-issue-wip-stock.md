# 자재출고 → 설비단위 공정재고(2단계 WIP) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 자재출고를 "창고 차감=소비"에서 "창고→설비별 공정창고 이동(적재)" + "생산실적 완료 시 공정창고에서 BOM 소비"의 2단계 모델로 전환한다.

**Architecture:**
- ① 이동: 작업지시 기반 출고(수동·PDA·출고요청)가 원자재창고에서 차감하고 **설비별 공정창고(`WIP_{equipCode}`)** 에 적재. `STOCK_TRANSACTIONS`에 `WIP_MOVE`(from=원자재창고, to=공정창고)로 기록.

> **transType 정정(2026-06-16):** 공정이동은 기존 `TRANSFER`(범용 창고이동)와 충돌하므로 **신규 `WIP_MOVE`/`WIP_MOVE_CANCEL`** 을 도입한다(공통코드 신규 추가). 이 문서 본문의 코드 스니펫에 남아있는 `TRANSFER`/`TRANSFER_CANCEL` 표기는 모두 `WIP_MOVE`/`WIP_MOVE_CANCEL`로 읽는다. `PROD_CONSUME`/`PROD_CONSUME_CANCEL`(소비)는 기존 공통코드 그대로 사용.
- ② 소비: 생산실적 완료 시 `auto-issue`가 **공정창고에서** BOM 기준으로 차감. `PROD_CONSUME`(from=공정창고)로 기록.
- 공정창고 단위는 **설비(equipCode)**. 라인(lineCode)·공정(processCode)은 참조정보로만 보관.

**Tech Stack:** NestJS + TypeORM(Oracle), Jest(.spec.ts) 단위 테스트, Next.js(App Router) 프론트, i18n 4-locale(ko/en/zh/vi). 패키지매니저 pnpm. Playwright 미사용 — 검증은 jest + API + `pnpm build`/`tsc`.

---

## 설계 확정사항 (이 계획의 전제)

| 항목 | 결정 |
|---|---|
| 공정창고 단위 | **설비(equipCode)**. 창고코드 규칙 `WIP_{equipCode}`, `warehouseType='WIP'` |
| 공정창고 식별 출처 | 작업지시(`JOB_ORDERS.EQUIP_CODE`)·생산실적(`PROD_RESULTS.EQUIP_CODE`) |
| 이동 transType | `WIP_MOVE` / 역분개 `WIP_MOVE_CANCEL` (**신규** 공통코드, Task 1에서 추가) |
| 소비 transType | `PROD_CONSUME` / 역분개 `PROD_CONSUME_CANCEL` (공통코드 기정의) |
| 공정재고 부족 정책 | 기존 `MAT_ISSUE_STOCK_CHECK`(BLOCK/WARN) 재활용, 기본 WARN |
| 기존 데이터 | 소급 없음, 배포 시점 이후 신규 출고부터 적용 |
| 적용 범위 | 작업지시 연결 출고(수동 orderNo 有·PDA·출고요청) + 생산 소비. 생산무관 일반출고(`inventory.issueStock`, orderNo 無)는 기존 `MAT_OUT` 유지 |

**미적용(범위 외):** `inventory.service.issueStock` 범용 출고, 폐기/샘플/설비보전 등 orderNo 없는 출고는 변경하지 않는다.

---

## File Structure

**백엔드 — 수정**
- `apps/backend/src/entities/warehouse.entity.ts` — `EQUIP_CODE` 컬럼 추가
- `apps/backend/src/modules/inventory/services/warehouse.service.ts` — 설비단위 공정창고 헬퍼 `getOrCreateEquipWipWarehouse()` 추가
- `apps/backend/src/modules/material/services/mat-issue.service.ts` — `createInTx` 이동 전환, `cancel` 역분개 대칭
- `apps/backend/src/modules/production/services/auto-issue.service.ts` — `issueFifo`/`deductMatStock` 차감 대상을 공정창고로
- `apps/backend/src/modules/production/services/prod-result.service.ts` — `reverseAutoIssue` 공정재고 복원 대칭
- `apps/backend/src/modules/material/services/issue-request.service.ts` — 공정창고 대상 인자 전달(간접)

**백엔드 — 신규**
- `apps/backend/src/migrations/2026-06-16_warehouse_equip_code.sql` — 컬럼 추가
- `apps/backend/src/migrations/2026-06-16_equip_wip_warehouse_seed.sql` — 설비별 공정창고 시드

**프론트 — 수정/신규**
- `apps/frontend/src/app/(authenticated)/material/stock/page.tsx` — 창고유형(원자재/공정) 구분 필터
- `apps/frontend/src/app/(authenticated)/inventory/transaction/page.tsx` — `TRANSFER`/`PROD_CONSUME` 라벨·색상
- `apps/frontend/src/app/(authenticated)/production/wip-material-stock/page.tsx` — (신규) 원자재 공정재고 조회
- `apps/frontend/src/locales/{ko,en,zh,vi}.json` — 거래유형 라벨

---

## Task 1: 거래유형 i18n 라벨 추가 (이동·소비)

`TRANSFER`/`PROD_CONSUME` 등은 공통코드 `TRANSACTION_TYPE_VALUES`에 이미 존재(`packages/shared/src/constants/com-code-values.ts:316-317`). 표시 라벨만 4-locale에 추가한다.

**Files:**
- Modify: `apps/frontend/src/locales/ko.json` (inventory.transaction 블록)
- Modify: `apps/frontend/src/locales/en.json`
- Modify: `apps/frontend/src/locales/zh.json`
- Modify: `apps/frontend/src/locales/vi.json`

- [ ] **Step 1: 4개 locale에 키 추가** (기존 `inventory.transaction` 블록에 add-only, BOM 금지)

ko.json:
```json
"transfer": "공정이동",
"transferCancel": "공정이동취소",
"prodConsume": "생산소비",
"prodConsumeCancel": "생산소비취소"
```
en.json:
```json
"transfer": "WIP Transfer",
"transferCancel": "WIP Transfer Cancel",
"prodConsume": "Production Consume",
"prodConsumeCancel": "Production Consume Cancel"
```
zh.json:
```json
"transfer": "工序移动",
"transferCancel": "工序移动取消",
"prodConsume": "生产消耗",
"prodConsumeCancel": "生产消耗取消"
```
vi.json:
```json
"transfer": "Chuyển công đoạn",
"transferCancel": "Hủy chuyển công đoạn",
"prodConsume": "Tiêu hao sản xuất",
"prodConsumeCancel": "Hủy tiêu hao sản xuất"
```

- [ ] **Step 2: JSON 유효성 + BOM 부재 검증**

Run:
```bash
node -e "for(const l of ['ko','en','zh','vi']){const t=require('fs').readFileSync('apps/frontend/src/locales/'+l+'.json');if(t[0]===0xEF)throw new Error(l+' has BOM');JSON.parse(t);console.log(l,'ok')}"
```
Expected: `ko ok / en ok / zh ok / vi ok`

- [ ] **Step 3: Commit**
```bash
git add apps/frontend/src/locales/
git commit -m "feat(i18n): 공정이동/생산소비 거래유형 라벨 4종 추가"
```

---

## Task 2: Warehouse 엔티티에 EQUIP_CODE 추가 + 마이그레이션

설비단위 공정창고를 표현하기 위해 `WAREHOUSES`에 `EQUIP_CODE`(nullable) 컬럼을 추가한다.

**Files:**
- Modify: `apps/backend/src/entities/warehouse.entity.ts` (processCode 컬럼 `:51-52` 다음)
- Create: `apps/backend/src/migrations/2026-06-16_warehouse_equip_code.sql`

- [ ] **Step 1: 엔티티에 컬럼 추가**

`apps/backend/src/entities/warehouse.entity.ts`의 `processCode` 정의 뒤에 추가:
```typescript
  @Column({ type: 'varchar2', name: 'EQUIP_CODE', length: 50, nullable: true })
  equipCode: string | null;
```

- [ ] **Step 2: 마이그레이션 SQL 작성**

`apps/backend/src/migrations/2026-06-16_warehouse_equip_code.sql`:
```sql
-- WAREHOUSES에 설비코드 컬럼 추가 (설비단위 공정창고용)
BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE WAREHOUSES ADD (EQUIP_CODE VARCHAR2(50))';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -1430 THEN RAISE; END IF; -- ORA-01430: 이미 존재 시 무시
END;
/
```

- [ ] **Step 3: JSHANES 적용**

Run:
```bash
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-06-16_warehouse_equip_code.sql
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME='WAREHOUSES' AND COLUMN_NAME='EQUIP_CODE'"
```
Expected: `EQUIP_CODE` 1행 반환

- [ ] **Step 4: 백엔드 타입 체크**

Run: `pnpm --filter @harness/backend exec tsc --noEmit`
Expected: 에러 0

- [ ] **Step 5: Commit**
```bash
git add apps/backend/src/entities/warehouse.entity.ts apps/backend/src/migrations/2026-06-16_warehouse_equip_code.sql
git commit -m "feat(inventory): WAREHOUSES에 EQUIP_CODE 추가 (설비단위 공정창고)"
```

---

## Task 3: 설비단위 공정창고 헬퍼 `getOrCreateEquipWipWarehouse`

기존 `getOrCreateFloorWarehouse(lineCode, processCode)`(`warehouse.service.ts:178`, 미사용)를 대체할 **설비 기준** 헬퍼를 추가한다. 창고코드 = `WIP_{equipCode}`.

**Files:**
- Modify: `apps/backend/src/modules/inventory/services/warehouse.service.ts`
- Test: `apps/backend/src/modules/inventory/services/warehouse.service.spec.ts`

- [ ] **Step 1: 실패 테스트 작성**

`warehouse.service.spec.ts`에 추가:
```typescript
describe('getOrCreateEquipWipWarehouse', () => {
  it('설비코드 기준 WIP_{equipCode} 창고를 없으면 생성한다', async () => {
    repo.findOne.mockResolvedValue(null);
    repo.create.mockImplementation((v) => v);
    repo.save.mockImplementation(async (v) => v);

    const wh = await service.getOrCreateEquipWipWarehouse('EQ-ATCNS-01', '40', '1000');

    expect(wh.warehouseCode).toBe('WIP_EQ-ATCNS-01');
    expect(wh.warehouseType).toBe('WIP');
    expect(wh.equipCode).toBe('EQ-ATCNS-01');
  });

  it('이미 있으면 기존 창고를 반환한다', async () => {
    repo.findOne.mockResolvedValue({ warehouseCode: 'WIP_EQ-ATCNS-01', warehouseType: 'WIP' });
    const wh = await service.getOrCreateEquipWipWarehouse('EQ-ATCNS-01', '40', '1000');
    expect(wh.warehouseCode).toBe('WIP_EQ-ATCNS-01');
    expect(repo.save).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @harness/backend exec jest warehouse.service -t getOrCreateEquipWipWarehouse`
Expected: FAIL — `service.getOrCreateEquipWipWarehouse is not a function`

- [ ] **Step 3: 헬퍼 구현**

`warehouse.service.ts`의 기존 `getOrCreateFloorWarehouse` 옆에 추가(기존 메서드는 유지):
```typescript
  /**
   * 설비단위 공정창고(WIP) 조회/생성. 코드규칙 WIP_{equipCode}.
   * 라인/공정은 참조정보로만 저장한다.
   */
  async getOrCreateEquipWipWarehouse(
    equipCode: string,
    company?: string,
    plant?: string,
    lineCode?: string | null,
    processCode?: string | null,
  ) {
    const warehouseCode = `WIP_${equipCode}`;
    const tenantWhere = {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
    let warehouse = await this.warehouseRepository.findOne({
      where: { warehouseCode, ...tenantWhere },
    });
    if (!warehouse) {
      warehouse = this.warehouseRepository.create({
        warehouseCode,
        warehouseName: `${equipCode} 공정재공`,
        warehouseType: 'WIP',
        plantCode: plant || null,
        equipCode,
        lineCode: lineCode ?? null,
        processCode: processCode ?? null,
        useYn: 'Y',
        isDefault: 'N',
        company: company || null,
        plant: plant || null,
      });
      warehouse = await this.warehouseRepository.save(warehouse);
    }
    return warehouse;
  }
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @harness/backend exec jest warehouse.service -t getOrCreateEquipWipWarehouse`
Expected: PASS (2건)

- [ ] **Step 5: Commit**
```bash
git add apps/backend/src/modules/inventory/services/warehouse.service.ts apps/backend/src/modules/inventory/services/warehouse.service.spec.ts
git commit -m "feat(inventory): 설비단위 공정창고 getOrCreateEquipWipWarehouse 추가"
```

---

## Task 4: 출고(이동) 전환 — `mat-issue.service.createInTx`

작업지시 연결 출고가 원자재창고 차감 후 **공정창고에 가산**(이동)하도록 변경한다. `STOCK_TRANSACTIONS`는 `TRANSFER`(from=원자재창고, to=`WIP_{equipCode}`)로 기록한다. 작업지시의 `equipCode`로 대상 공정창고를 결정한다.

> **전제:** `createInTx`의 출고 DTO/흐름에 `orderNo`가 존재한다(현재 `mat-issue`는 작업지시 출고에서 orderNo 보유). `orderNo`로 `JOB_ORDERS.EQUIP_CODE`를 조회한다. `orderNo`가 없으면(생산무관) 기존 `MAT_OUT` 단순 차감을 유지한다.

**Files:**
- Modify: `apps/backend/src/modules/material/services/mat-issue.service.ts:179-285`
- Test: `apps/backend/src/modules/material/services/mat-issue.service.spec.ts`

- [ ] **Step 1: 실패 테스트 작성** (orderNo 있는 출고 = 이동)

```typescript
describe('createInTx - 공정 이동', () => {
  it('orderNo가 있으면 원자재창고 차감 + 공정창고(WIP_{equip}) 가산, TRANSFER 기록', async () => {
    // 작업지시 EQ-ATCNS-01 가정, 재고 RAW에 100
    // mock: jobOrderRepo.findOne -> { orderNo:'WO1', equipCode:'EQ-ATCNS-01' }
    //       matStock(RAW_WH, 100), warehouseService.getOrCreateEquipWipWarehouse -> {warehouseCode:'WIP_EQ-ATCNS-01'}
    const res = await service.createInTx(qr, {
      issueNo: 'IS1', items: [{ matUid: 'M1', issueQty: 30 }], orderNo: 'WO1',
    } as any, '40', '1000');

    // 원자재창고 30 차감
    expect(matStockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ warehouseCode: 'RAW_WH' }),
      expect.objectContaining({ qty: 70 }),
    );
    // 공정창고 30 가산 (신규 또는 update)
    expect(wipStockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ warehouseCode: 'WIP_EQ-ATCNS-01', qty: 30 }),
    );
    // TRANSFER 거래
    expect(stockTxSave).toHaveBeenCalledWith(
      expect.objectContaining({ transType: 'TRANSFER', fromWarehouseId: 'RAW_WH', toWarehouseId: 'WIP_EQ-ATCNS-01' }),
    );
  });
});
```
> 정확한 mock 헬퍼명은 기존 spec 패턴(`queryRunner.manager.update/save` 스파이)에 맞춰 작성한다. 위는 의도 표현.

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @harness/backend exec jest mat-issue.service -t "공정 이동"`
Expected: FAIL (현재는 toWarehouse 가산/ TRANSFER 없음)

- [ ] **Step 3: createInTx 수정**

`mat-issue.service.ts:242-266` 블록을 다음 로직으로 교체:
1. 메서드 진입부에서 `orderNo`가 있으면 `JOB_ORDERS`에서 `equipCode, processCode, lineCode` 조회, `warehouseService.getOrCreateEquipWipWarehouse(equipCode, company, plant, lineCode, processCode)`로 대상 공정창고 확보. `orderNo`/`equipCode` 없으면 `wipWarehouse = null`(기존 MAT_OUT 경로).
2. 차감 루프에서:
```typescript
const isMove = !!wipWarehouse;
const stockTx = queryRunner.manager.create(StockTransaction, {
  transNo,
  transType: isMove ? 'TRANSFER' : 'MAT_OUT',
  fromWarehouseId: stock.warehouseCode,
  toWarehouseId: isMove ? wipWarehouse.warehouseCode : null,
  itemCode: lot.itemCode,
  matUid: item.matUid,
  qty: -issueQty,
  remark: remark || (isMove ? `공정이동: ${lot.matUid}` : `자재출고: ${lot.matUid}`),
  workerId,
  refType: 'MAT_ISSUE',
  refId: `${savedIssue.issueNo}-${savedIssue.seq}`,
  status: 'DONE',
  company: lot.company,
  plant: lot.plant,
});
await queryRunner.manager.save(stockTx);

// 원자재창고 차감 (기존 유지)
await queryRunner.manager.update(MatStock, { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, matUid: stock.matUid, ...tenantWhere },
  { qty: Math.max(0, stock.qty - issueQty), availableQty: Math.max(0, stock.availableQty - issueQty) });

// 이동이면 공정창고 가산(upsert)
if (isMove) {
  await this.upsertWipStock(queryRunner, wipWarehouse.warehouseCode, stock.itemCode, stock.matUid, issueQty, lot.company, lot.plant, tenantWhere);
}
```
3. `upsertWipStock` private 헬퍼 추가(공정창고 MatStock 행이 없으면 create, 있으면 qty/availableQty 가산). `matUid` 복합키 유지로 LOT 추적 보존.

```typescript
private async upsertWipStock(qr, warehouseCode, itemCode, matUid, addQty, company, plant, tenantWhere) {
  const existing = await qr.manager.findOne(MatStock, { where: { warehouseCode, itemCode, matUid, ...tenantWhere } });
  if (existing) {
    await qr.manager.update(MatStock, { warehouseCode, itemCode, matUid, ...tenantWhere },
      { qty: (existing.qty ?? 0) + addQty, availableQty: (existing.availableQty ?? 0) + addQty });
  } else {
    await qr.manager.save(qr.manager.create(MatStock, {
      warehouseCode, itemCode, matUid, qty: addQty, availableQty: addQty, reservedQty: 0,
      company: company ?? null, plant: plant ?? null,
    }));
  }
}
```
4. **이동 시 LOT을 DEPLETED 처리하지 않는다**: 기존 `mat-issue.service.ts:277-279`의 LOT DEPLETED 로직은 전체 잔여(원자재+공정창고 합산)가 0일 때만 동작하므로 이동 시엔 합계 불변 → 자동으로 DEPLETED 안 됨. 확인만.

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @harness/backend exec jest mat-issue.service`
Expected: PASS (신규 + 기존 회귀)

- [ ] **Step 5: Commit**
```bash
git add apps/backend/src/modules/material/services/mat-issue.service.ts apps/backend/src/modules/material/services/mat-issue.service.spec.ts
git commit -m "feat(material): 작업지시 출고를 설비 공정창고 이동(TRANSFER)으로 전환"
```

---

## Task 5: 출고(이동) 역분개 — `mat-issue.service.cancel`

이동 출고 취소 시 **공정창고 차감 + 원자재창고 복원**, `TRANSFER_CANCEL` 기록으로 대칭 처리한다.

**Files:**
- Modify: `apps/backend/src/modules/material/services/mat-issue.service.ts:339-436`
- Test: `apps/backend/src/modules/material/services/mat-issue.service.spec.ts`

- [ ] **Step 1: 실패 테스트 작성**
```typescript
describe('cancel - 공정이동 역분개', () => {
  it('TRANSFER 출고 취소 시 공정창고 차감 + 원자재창고 복원, TRANSFER_CANCEL 기록', async () => {
    // 원본 tx: transType TRANSFER, from RAW_WH, to WIP_EQ-ATCNS-01, qty -30
    const res = await service.cancel('IS1', 1, '취소', '40', '1000');
    expect(matStockUpdateRaw).toHaveBeenCalledWith(
      expect.objectContaining({ warehouseCode: 'RAW_WH' }), expect.objectContaining({ qty: 100 }));
    expect(matStockUpdateWip).toHaveBeenCalledWith(
      expect.objectContaining({ warehouseCode: 'WIP_EQ-ATCNS-01' }), expect.objectContaining({ qty: 0 }));
    expect(cancelTxSave).toHaveBeenCalledWith(
      expect.objectContaining({ transType: 'TRANSFER_CANCEL' }));
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @harness/backend exec jest mat-issue.service -t "공정이동 역분개"`
Expected: FAIL

- [ ] **Step 3: cancel 수정**

`cancel`의 역분개 루프에서 원본 `originalTx.transType`을 분기:
```typescript
const isMove = originalTx.transType === 'TRANSFER';
const restoreQty = Math.abs(originalTx.qty);

if (isMove) {
  // 공정창고(원본 toWarehouseId) 차감
  await queryRunner.manager.update(MatStock,
    { warehouseCode: originalTx.toWarehouseId, itemCode: originalTx.itemCode, matUid: originalTx.matUid, ...tenantWhere },
    { qty: () => `GREATEST(QTY - ${restoreQty}, 0)`, availableQty: () => `GREATEST(AVAILABLE_QTY - ${restoreQty}, 0)` });
}
// 원자재창고(원본 fromWarehouseId) 복원
await queryRunner.manager.update(MatStock,
  { warehouseCode: originalTx.fromWarehouseId, itemCode: originalTx.itemCode, matUid: originalTx.matUid, ...tenantWhere },
  { qty: () => `QTY + ${restoreQty}`, availableQty: () => `AVAILABLE_QTY + ${restoreQty}` });

const cancelTx = queryRunner.manager.create(StockTransaction, {
  transNo: cancelTransNo,
  transType: isMove ? 'TRANSFER_CANCEL' : 'MAT_OUT_CANCEL',
  fromWarehouseId: isMove ? originalTx.toWarehouseId : null,
  toWarehouseId: originalTx.fromWarehouseId,
  itemCode: originalTx.itemCode,
  matUid: originalTx.matUid,
  qty: restoreQty,
  refType: 'MAT_ISSUE_CANCEL',
  cancelRefId: originalTx.transNo,
  status: 'DONE',
  company: originalTx.company,
  plant: originalTx.plant,
});
await queryRunner.manager.save(cancelTx);
```
> 부수 효과: 기존 라인 368의 역분개 `transType: 'MAT_OUT'` 버그(앞 조사에서 식별)도 위 분기로 `MAT_OUT_CANCEL`로 정정된다.

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @harness/backend exec jest mat-issue.service`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add apps/backend/src/modules/material/services/mat-issue.service.ts apps/backend/src/modules/material/services/mat-issue.service.spec.ts
git commit -m "feat(material): 공정이동 출고 취소 역분개(TRANSFER_CANCEL) 대칭 처리"
```

---

## Task 6: 소비 전환 — `auto-issue` 공정창고 차감

생산실적 시점의 자동차감을 **원자재창고가 아니라 설비 공정창고(`WIP_{equipCode}`)에서** BOM 기준으로 차감하도록 변경한다. `STOCK_TRANSACTIONS`는 `PROD_CONSUME`(from=공정창고). 작업지시/생산실적의 `equipCode`로 공정창고를 결정.

**Files:**
- Modify: `apps/backend/src/modules/production/services/auto-issue.service.ts:268-439` (`issueFifo`, `deductMatStock`)
- Test: `apps/backend/src/modules/production/services/auto-issue.service.spec.ts`

- [ ] **Step 1: 실패 테스트 작성**
```typescript
describe('issueFifo - 공정창고 소비', () => {
  it('공정창고(WIP_{equip}) 재고에서 차감하고 PROD_CONSUME으로 기록한다', async () => {
    // 작업지시 WO1 equipCode EQ-ATCNS-01, 공정창고 WIP_EQ-ATCNS-01 재고 50
    const result = await service.executeInTransaction(qr, 'ON_COMPLETE', 'R1', 'WO1', 5, tenant);
    expect(deductFromWarehouse).toBe('WIP_EQ-ATCNS-01');
    expect(stockTxSave).toHaveBeenCalledWith(
      expect.objectContaining({ transType: 'PROD_CONSUME', fromWarehouseId: 'WIP_EQ-ATCNS-01' }));
  });

  it('공정창고 재고 부족 시 정책(WARN)이면 가용분만 차감하고 경고를 남긴다', async () => {
    // 공정창고 재고 2, 필요 5, MAT_ISSUE_STOCK_CHECK=WARN
    const result = await service.executeInTransaction(qr, 'ON_COMPLETE', 'R1', 'WO1', 5, tenant);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @harness/backend exec jest auto-issue.service -t "공정창고 소비"`
Expected: FAIL

- [ ] **Step 3: auto-issue 수정**
1. `executeInTransaction`(`:138`)에서 작업지시 조회 시 `equipCode`를 함께 얻고, `warehouseService.getOrCreateEquipWipWarehouse(equipCode, ...)`로 공정창고코드 확보 → `issueFifo`에 `wipWarehouseCode` 인자로 전달.
2. `issueFifo`(`:268`)의 재고 조회/차감 대상을 `wipWarehouseCode`로 한정(현재 원자재창고 전체 FIFO → 공정창고 한정 FIFO). 스캔 LOT 우선순위 로직은 유지.
3. `deductMatStock`(`:404`)이 `wipWarehouseCode`에서 차감하도록 수정.
4. 생성 거래 `transType: 'MAT_OUT'` → `'PROD_CONSUME'`, `fromWarehouseId: wipWarehouseCode`.
5. 공정창고 재고 부족 처리: 기존 `MAT_ISSUE_STOCK_CHECK` 정책 재사용. BLOCK이면 `BadRequestException(\`공정재고 부족: 자재준비 출고 필요 (${itemCode})\`)`, WARN이면 가용분만 차감 후 `result.warnings.push(...)`.

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @harness/backend exec jest auto-issue.service`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add apps/backend/src/modules/production/services/auto-issue.service.ts apps/backend/src/modules/production/services/auto-issue.service.spec.ts
git commit -m "feat(production): 자동차감을 설비 공정창고 소비(PROD_CONSUME)로 전환"
```

---

## Task 7: 소비 역분개 — `prod-result.reverseAutoIssue`

생산실적 취소 시 공정창고 재고를 복원하고 `PROD_CONSUME_CANCEL`로 기록하도록 대칭 수정한다.

**Files:**
- Modify: `apps/backend/src/modules/production/services/prod-result.service.ts:1026-1185` (reverseAutoIssue)
- Test: `apps/backend/src/modules/production/services/prod-result.service.spec.ts` (있으면) 또는 auto-issue.service.spec.ts

- [ ] **Step 1: 실패 테스트 작성**
```typescript
describe('reverseAutoIssue - 공정재고 복원', () => {
  it('PROD_CONSUME 소비 취소 시 공정창고 복원 + PROD_CONSUME_CANCEL 기록', async () => {
    // 원본: transType PROD_CONSUME, from WIP_EQ-ATCNS-01, qty -5
    await service.reverseAutoIssue(qr, 'R1', '40', '1000');
    expect(wipStockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ warehouseCode: 'WIP_EQ-ATCNS-01' }), expect.objectContaining({ qty: 5 }));
    expect(cancelTxSave).toHaveBeenCalledWith(
      expect.objectContaining({ transType: 'PROD_CONSUME_CANCEL', toWarehouseId: 'WIP_EQ-ATCNS-01' }));
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @harness/backend exec jest -t "공정재고 복원"`
Expected: FAIL

- [ ] **Step 3: reverseAutoIssue 수정**
- 원본 거래 조회 조건을 `transType IN ('MAT_OUT','PROD_CONSUME')` 호환으로 두되, 복원 대상 창고는 `originalTx.fromWarehouseId`(공정창고).
- 복원 거래 `transType`을 `originalTx.transType === 'PROD_CONSUME' ? 'PROD_CONSUME_CANCEL' : 'MAT_IN'`로 분기.
- 복원 대상 `MatStock`을 `originalTx.fromWarehouseId`(공정창고)에 가산:
```typescript
await qr.manager.update(MatStock,
  { warehouseCode: originalTx.fromWarehouseId, itemCode: originalTx.itemCode, matUid: originalTx.matUid, ...tenantWhere },
  { qty: () => `QTY + ${Math.abs(originalTx.qty)}`, availableQty: () => `AVAILABLE_QTY + ${Math.abs(originalTx.qty)}` });
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @harness/backend exec jest prod-result.service auto-issue.service`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add apps/backend/src/modules/production/services/prod-result.service.ts apps/backend/src/modules/production/services/*.spec.ts
git commit -m "feat(production): 생산실적 취소 시 공정재고 복원(PROD_CONSUME_CANCEL)"
```

---

## Task 8: 설비별 공정창고 시드 마이그레이션

기존 설비(`EQUIP_MASTERS` 사용 중)에 대해 `WIP_{equipCode}` 공정창고를 일괄 생성한다. 런타임 `getOrCreateEquipWipWarehouse`가 누락분을 자동 생성하지만, 운영 가시성을 위해 시드도 둔다.

**Files:**
- Create: `apps/backend/src/migrations/2026-06-16_equip_wip_warehouse_seed.sql`

- [ ] **Step 1: 시드 SQL 작성** (실 컬럼명은 Task 2 적용 후 `WAREHOUSES` describe로 확인 후 채움)
```sql
-- 사용중 설비별 공정창고(WIP) 생성 (멱등 MERGE)
MERGE INTO WAREHOUSES w
USING (
  SELECT 'WIP_' || e.EQUIP_CODE AS WAREHOUSE_CODE, e.EQUIP_CODE,
         e.EQUIP_NAME || ' 공정재공' AS WAREHOUSE_NAME,
         e.COMPANY, e.PLANT_CD
  FROM EQUIP_MASTERS e
  WHERE e.USE_YN = 'Y'
) s
ON (w.WAREHOUSE_CODE = s.WAREHOUSE_CODE AND w.COMPANY = s.COMPANY AND w.PLANT_CD = s.PLANT_CD)
WHEN NOT MATCHED THEN INSERT
  (WAREHOUSE_CODE, WAREHOUSE_NAME, WAREHOUSE_TYPE, EQUIP_CODE, PLANT_CODE, USE_YN, IS_DEFAULT, COMPANY, PLANT_CD, CREATED_AT, UPDATED_AT)
  VALUES
  (s.WAREHOUSE_CODE, s.WAREHOUSE_NAME, 'WIP', s.EQUIP_CODE, s.PLANT_CD, 'Y', 'N', s.COMPANY, s.PLANT_CD, SYSTIMESTAMP, SYSTIMESTAMP);
```
> 실행 전 `EQUIP_MASTERS`·`WAREHOUSES` 실제 컬럼명(EQUIP_NAME/COMPANY/PLANT_CD 등)을 describe로 검증하고 일치시킨다.

- [ ] **Step 2: JSHANES 적용 + 검증**
```bash
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-06-16_equip_wip_warehouse_seed.sql
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT WAREHOUSE_CODE, EQUIP_CODE FROM WAREHOUSES WHERE WAREHOUSE_TYPE='WIP' AND WAREHOUSE_CODE LIKE 'WIP_%'"
```
Expected: 사용중 설비 수만큼 `WIP_*` 행

- [ ] **Step 3: Commit**
```bash
git add apps/backend/src/migrations/2026-06-16_equip_wip_warehouse_seed.sql
git commit -m "feat(inventory): 설비별 공정창고(WIP_{equip}) 시드"
```

---

## Task 9: 자재재고 화면 — 원자재/공정 창고 구분 필터

출고가 이동이 되면 공정창고 재고가 `MAT_STOCKS`에 함께 잡힌다. `material/stock` 화면에 창고유형(원자재/공정) 구분 필터·표시를 추가한다.

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/material/stock/page.tsx`

- [ ] **Step 1: 창고유형 필터 추가**

기존 창고 필터 영역에 `warehouseType` 셀렉트(전체/원자재(RAW_MATERIAL)/공정(WIP)) 추가. 목록 행에 창고유형 배지(`ComCodeBadge` 또는 라벨) 표시. 백엔드 `GET /material/stocks`가 `warehouseType` 파라미터를 받는지 확인하고, 없으면 `warehouseCode LIKE 'WIP_%'` 클라이언트 구분 또는 백엔드 필터 추가.

- [ ] **Step 2: 타입 체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0

- [ ] **Step 3: Commit**
```bash
git add apps/frontend/src/app/(authenticated)/material/stock/page.tsx
git commit -m "feat(material): 자재재고 화면 원자재/공정 창고유형 구분 필터"
```

---

## Task 10: 원자재 공정재고 조회 화면/API

설비별 공정재고(원자재 WIP)를 조회하는 화면을 신설한다. 기존 `production/wip-stock`은 반제품(PRODUCT_STOCKS) 전용이므로 분리한다.

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/production/wip-material-stock/page.tsx`
- Modify: `apps/frontend/src/config/menuConfig.ts` (메뉴 등록)
- Modify: `apps/frontend/src/locales/{ko,en,zh,vi}.json` (메뉴 라벨)
- 백엔드: 기존 `GET /material/stocks?warehouseType=WIP` 재사용(신규 API 불필요 시)

- [ ] **Step 1: 화면 작성**

`MAT_STOCKS` 중 `warehouseType='WIP'`(또는 `warehouseCode LIKE 'WIP_%'`)를 설비별 그룹으로 표시. 컬럼: 설비, 품목, LOT(matUid), 수량. `StatCard`로 설비수/총수량 요약. DataGrid 모달은 `xl`+.

- [ ] **Step 2: 메뉴 등록 + i18n**

`menuConfig.ts` 생산관리 하위에 `wip-material-stock` 추가, 4-locale 메뉴 라벨(공정재고/WIP Material Stock/工序物料库存/Tồn kho vật tư công đoạn). 시드 재생성 필요 시 `gen-menu-category-seed.js` 흐름 따름.

- [ ] **Step 3: 타입 체크 + JSON 검증**

Run:
```bash
pnpm --filter @harness/frontend exec tsc --noEmit
node -e "['ko','en','zh','vi'].forEach(l=>JSON.parse(require('fs').readFileSync('apps/frontend/src/locales/'+l+'.json')))"
```
Expected: 에러 0

- [ ] **Step 4: Commit**
```bash
git add apps/frontend/src/app/(authenticated)/production/wip-material-stock/ apps/frontend/src/config/menuConfig.ts apps/frontend/src/locales/
git commit -m "feat(production): 설비별 원자재 공정재고 조회 화면 신설"
```

---

## Task 11: 수불·PDA/수동 출고 화면 표기 보정

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/inventory/transaction/page.tsx`
- Modify: `apps/frontend/src/hooks/pda/useMatIssuingScan.ts` 및 PDA 출고 페이지

- [ ] **Step 1: 수불 화면 거래유형 추가**

`TRANS_TYPES` 배열에 `{ value: 'TRANSFER', label: t('inventory.transaction.transfer') }`, `{ value: 'PROD_CONSUME', label: t('inventory.transaction.prodConsume') }`(+ 취소형) 추가. `getTransTypeColor`에서 TRANSFER=보라(기존), PROD_CONSUME=주황(출고계열).

- [ ] **Step 2: PDA/수동 출고 결과 표기**

출고 성공 토스트/결과에 "공정창고(설비)로 이동됨"이 드러나도록 문구 조정(선택). 기능 영향 없음.

- [ ] **Step 3: 타입 체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0

- [ ] **Step 4: Commit**
```bash
git add apps/frontend/src/app/(authenticated)/inventory/transaction/page.tsx apps/frontend/src/hooks/pda/useMatIssuingScan.ts
git commit -m "feat(inventory): 수불 화면 공정이동/생산소비 거래유형 표기"
```

---

## Task 12: 통합 검증 (JSHANES 실데이터 E2E)

**Files:** 없음(검증 전용). 산출물: `docs/reports/mat-issue-wip-stock-verify-2026-06-16.md`

- [ ] **Step 1: 전체 빌드**

Run: `pnpm build`
Expected: 백엔드/프론트 빌드 에러 0
> dev 서버 가동 중이면 `pnpm build` 대신 `tsc --noEmit`로 대체(CLAUDE.md 규칙).

- [ ] **Step 2: 시나리오 실측** (JSHANES, 작업지시 1건)

1. 작업지시(설비 EQ-ATCNS-01) 자재출고 → `STOCK_TRANSACTIONS`에 `TRANSFER`(from=원자재창고, to=`WIP_EQ-ATCNS-01`) 1건, `MAT_STOCKS`에서 원자재창고 차감 + `WIP_EQ-ATCNS-01` 가산 확인:
```bash
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT TRANS_TYPE, FROM_WAREHOUSE_ID, TO_WAREHOUSE_ID, QTY FROM STOCK_TRANSACTIONS WHERE REF_TYPE='MAT_ISSUE' ORDER BY CREATED_AT DESC FETCH FIRST 5 ROWS ONLY"
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT WAREHOUSE_CODE, ITEM_CODE, QTY FROM MAT_STOCKS WHERE WAREHOUSE_CODE LIKE 'WIP_%' ORDER BY UPDATED_AT DESC FETCH FIRST 5 ROWS ONLY"
```
2. 생산실적 완료 → `PROD_CONSUME`(from=`WIP_EQ-ATCNS-01`)로 공정재고 차감 확인.
3. 생산실적 취소 → `PROD_CONSUME_CANCEL`로 공정재고 복원 확인.
4. 출고 취소 → `TRANSFER_CANCEL`로 원자재창고 복원 확인.
5. 이중차감 부재 확인: 원자재창고가 생산실적 시점에 추가 차감되지 않음.

- [ ] **Step 3: 결과 기록 + Commit**
```bash
git add docs/reports/mat-issue-wip-stock-verify-2026-06-16.md
git commit -m "docs: 자재출고 공정재고 2단계 모델 통합 검증 기록"
```

---

## 위험 / 운영 주의

- **Cutover(전환 시점):** 배포 직후 진행 중인 작업지시는 "자재 준비 출고가 안 된" 상태일 수 있다 → 첫 생산실적 완료 시 공정재고 부족(WARN/BLOCK). 운영 공지 또는 전환 스크립트로 진행중 작업지시분을 공정창고로 1회 이관 필요. (별도 결정)
- **이중차감 회귀:** Task 6에서 auto-issue가 원자재창고를 더 이상 건드리지 않는지 회귀 테스트로 반드시 확인.
- **공정창고 누적:** 소비(Task 6)가 정상 동작하지 않으면 공정창고에 원자재가 무한 누적된다 → Task 12 시나리오 2(소비) 필수 통과.
- **협업 보드:** 구현 착수 시 `.ai-coordination/LOCKS.md`에 위 파일 목록으로 lock 등록(특히 공유 모듈 `mat-issue.service.ts`, `auto-issue.service.ts`, `prod-result.service.ts`, `menuConfig.ts`, locales).

## Self-Review 결과
- 스펙 커버리지: 이동(T4)·소비(T6)·양단 역분개(T5/T7)·설비단위 창고(T2/T3/T8)·화면(T9/T10/T11)·i18n(T1)·검증(T12) 모두 매핑됨.
- 타입 일관성: `getOrCreateEquipWipWarehouse`(T3) ↔ 호출(T4/T6), `WIP_{equipCode}` 코드규칙 전 task 동일, `TRANSFER`/`PROD_CONSUME` 및 `_CANCEL` 짝 일관.
- 플레이스홀더: 정형 작업(시드 컬럼명, 화면 상세)은 "실 컬럼 describe 후 확정"으로 명시 — 실행 시 실측 의존 부분만 남김.
