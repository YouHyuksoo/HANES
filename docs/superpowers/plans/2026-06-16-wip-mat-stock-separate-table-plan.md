# 공정재고 별도 테이블(WIP_MAT_STOCKS) — forward-fix 개정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 공정재고를 `MAT_STOCKS`의 WIP 창고 행이 아니라 **설비 단위 전용 테이블 `WIP_MAT_STOCKS` + 전용 거래원장 `WIP_MAT_TRANSACTIONS`** 로 관리하도록, 기존 main 커밋을 forward-fix로 수정한다.

**Architecture:** ① 작업지시 출고 = 원자재창고(`MAT_STOCKS`) 차감 + `STOCK_TRANSACTIONS` `WIP_MOVE`, 동시에 공정재고(`WIP_MAT_STOCKS`) 가산 + `WIP_MAT_TRANSACTIONS` `WIP_IN`. ② 생산실적 완료 = `WIP_MAT_STOCKS` 차감 + `WIP_MAT_TRANSACTIONS` `PROD_CONSUME`. 취소는 대칭. 공정재고는 `(COMPANY,PLANT_CD,EQUIP_CODE,ITEM_CODE,MAT_UID)` 키.

**Tech Stack:** NestJS + TypeORM(Oracle), Jest(.spec.ts). pnpm. 채번 신규 `WIP_TX` 시퀀스. DB 적용은 JSHANES(사용자 승인). `--query` 경로 권장(PL/SQL 슬래시 파싱 이슈 회피).

**선행 설계:** `docs/superpowers/specs/2026-06-16-wip-mat-stock-separate-table-design.md`

---

## 현재 상태 (이미 커밋된 작업)
- Task 1(공통코드 `WIP_MOVE`/`WIP_MOVE_CANCEL` + i18n) — 유지
- Task 2(WAREHOUSES.EQUIP_CODE), Task 3(getOrCreateEquipWipWarehouse) — 미사용 처리
- Task 4/5(mat-issue 출고이동/취소, MAT_STOCKS WIP 방식) — 재작업 대상
- Task 6/7(auto-issue 소비/취소, MAT_STOCKS WIP 방식) — 재작업 대상
- Task 8(JSHANES WIP 창고 46행 시드) — 롤백 대상
- Task 9(자재재고 warehouseType 필터) — 롤백 대상
- Task 11(수불 라벨) — 유지

---

## Task R1: 공정재고 2테이블 엔티티 + 마이그레이션 + WIP_TX 채번

**Files:**
- Create: `apps/backend/src/entities/wip-mat-stock.entity.ts`
- Create: `apps/backend/src/entities/wip-mat-transaction.entity.ts`
- Create: `apps/backend/src/migrations/2026-06-16_wip_mat_stock_tables.sql`
- 참고(구조 모방): `apps/backend/src/entities/mat-stock.entity.ts`, `stock-transaction.entity.ts`

- [ ] **Step 1: 참고 엔티티 확인** — mat-stock.entity.ts(복합키·컬럼명·감사컬럼 패턴), stock-transaction.entity.ts(거래원장 컬럼), 채번 서비스(`numbering.nextInTx('STOCK_TX')` 사용처)를 읽는다.

- [ ] **Step 2: 마이그레이션 SQL 작성** `2026-06-16_wip_mat_stock_tables.sql` (각 문을 `/`로 분리)
```sql
CREATE TABLE WIP_MAT_STOCKS (
  COMPANY        VARCHAR2(50)  NOT NULL,
  PLANT_CD       VARCHAR2(50)  NOT NULL,
  EQUIP_CODE     VARCHAR2(50)  NOT NULL,
  ITEM_CODE      VARCHAR2(50)  NOT NULL,
  MAT_UID        VARCHAR2(100) NOT NULL,
  QTY            NUMBER        DEFAULT 0 NOT NULL,
  AVAILABLE_QTY  NUMBER        DEFAULT 0 NOT NULL,
  RESERVED_QTY   NUMBER        DEFAULT 0 NOT NULL,
  CREATED_AT     TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
  UPDATED_AT     TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT PK_WIP_MAT_STOCKS PRIMARY KEY (COMPANY, PLANT_CD, EQUIP_CODE, ITEM_CODE, MAT_UID)
);
/
CREATE TABLE WIP_MAT_TRANSACTIONS (
  TRANS_NO          VARCHAR2(50)  NOT NULL,
  TRANS_TYPE        VARCHAR2(50)  NOT NULL,
  EQUIP_CODE        VARCHAR2(50)  NOT NULL,
  ITEM_CODE         VARCHAR2(50)  NOT NULL,
  MAT_UID           VARCHAR2(100) NOT NULL,
  QTY               NUMBER        NOT NULL,
  FROM_WAREHOUSE_ID VARCHAR2(50),
  ORDER_NO          VARCHAR2(50),
  REF_TYPE          VARCHAR2(50),
  REF_ID            VARCHAR2(100),
  CANCEL_REF_ID     VARCHAR2(50),
  STATUS            VARCHAR2(20)  DEFAULT 'DONE' NOT NULL,
  REMARK            VARCHAR2(500),
  WORKER_ID         VARCHAR2(50),
  COMPANY           VARCHAR2(50)  NOT NULL,
  PLANT_CD          VARCHAR2(50)  NOT NULL,
  CREATED_AT        TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
  UPDATED_AT        TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT PK_WIP_MAT_TRANSACTIONS PRIMARY KEY (TRANS_NO)
);
/
CREATE INDEX IX_WIP_MAT_TX_EQUIP ON WIP_MAT_TRANSACTIONS (EQUIP_CODE, ITEM_CODE);
/
CREATE INDEX IX_WIP_MAT_TX_REF ON WIP_MAT_TRANSACTIONS (REF_TYPE, REF_ID);
/
CREATE SEQUENCE SEQ_WIP_TX START WITH 1 INCREMENT BY 1 NOCACHE;
/
```
> 채번 형식은 기존 STOCK_TX 패턴 확인 후 일치(예: `WTX` + 일자 + seq). 시퀀스명/형식은 기존 numbering.service 규칙에 맞춘다.

- [ ] **Step 3: 엔티티 작성** — `WipMatStock`(테이블 `WIP_MAT_STOCKS`, 복합키, mat-stock.entity 패턴), `WipMatTransaction`(테이블 `WIP_MAT_TRANSACTIONS`). 모든 컬럼 `name: 'UPPER_SNAKE'` 명시. 감사컬럼 DEFAULT SYSTIMESTAMP 의존(JS에서 안 채움 — Oracle DEFAULT 사용).

- [ ] **Step 4: 채번 등록** — numbering.service에 `WIP_TX`(SEQ_WIP_TX 기반) 추가. 기존 STOCK_TX 정의 패턴 모방.

- [ ] **Step 5: 모듈 등록** — 두 엔티티를 TypeORM `forFeature`에 등록(해당 모듈).

- [ ] **Step 6: JSHANES 적용 + 검증**
```bash
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-06-16_wip_mat_stock_tables.sql
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT TABLE_NAME FROM USER_TABLES WHERE TABLE_NAME IN ('WIP_MAT_STOCKS','WIP_MAT_TRANSACTIONS')"
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT SEQUENCE_NAME FROM USER_SEQUENCES WHERE SEQUENCE_NAME='SEQ_WIP_TX'"
```
기대: 2 테이블 + 시퀀스 확인.
> CREATE는 `/` 분리 PL/SQL 아님 — execute-file이 슬래시 분리하므로 OK. 실패 시 각 문을 --query로 개별 실행.

- [ ] **Step 7: tsc** `pnpm --filter @harness/backend exec tsc --noEmit` → 0

- [ ] **Step 8: Commit**
```bash
git add apps/backend/src/entities/wip-mat-stock.entity.ts apps/backend/src/entities/wip-mat-transaction.entity.ts apps/backend/src/migrations/2026-06-16_wip_mat_stock_tables.sql apps/backend/src/shared/numbering.service.ts apps/backend/src/modules/
git commit -m "feat(inventory): 공정재고 전용 테이블 WIP_MAT_STOCKS/WIP_MAT_TRANSACTIONS + WIP_TX 채번"
```

---

## Task R2: 공정재고 서비스 (가산/차감/조회 + 거래원장 기록)

`WIP_MAT_STOCKS`/`WIP_MAT_TRANSACTIONS`를 다루는 단일 책임 서비스. 출고이동·소비·취소·조회가 모두 이 서비스를 통하도록.

**Files:**
- Create: `apps/backend/src/modules/inventory/services/wip-mat-stock.service.ts`
- Test: `apps/backend/src/modules/inventory/services/wip-mat-stock.service.spec.ts`

- [ ] **Step 1: 실패 테스트 작성** — 4개 메서드:
  - `addStockInTx(qr, {equipCode,itemCode,matUid,qty,transType,fromWarehouseId?,orderNo?,refType,refId,...})` — 잔량 upsert(가산) + WIP_MAT_TRANSACTIONS(qty+) 기록.
  - `deductStockInTx(qr, {equipCode,itemCode,matUid,qty,transType,refType,refId,...stockPolicy})` — FIFO/지정 LOT 차감(가용분), 부족 시 BLOCK/WARN, WIP_MAT_TRANSACTIONS(qty−) 기록.
  - `restoreInTx(...)` — 취소 복원(가산/차감 반대) + *_CANCEL 거래.
  - `findByEquip(equipCode, company, plant)` — 조회.
  테스트: 가산 시 없으면 create/있으면 update + 거래 1건; 차감 시 잔량 감소 + PROD_CONSUME 음수; 부족 WARN 시 가용분만+경고.

- [ ] **Step 2: 실패 확인** `pnpm --filter @harness/backend exec jest wip-mat-stock.service` → FAIL

- [ ] **Step 3: 구현** — mat-issue의 `upsertWipStock`(Task 4 추가분) 로직을 이 서비스로 이관·일반화. 채번 `WIP_TX`. 멀티테넌시. `as any` 금지.

- [ ] **Step 4: 통과** `jest wip-mat-stock.service` → PASS, tsc 0

- [ ] **Step 5: Commit** `feat(inventory): 공정재고 서비스(WipMatStockService) 추가`

---

## Task R3: mat-issue 출고이동 재작업 (Task 4 forward-fix)

기존 `createInTx`의 `upsertWipStock`(MAT_STOCKS WIP 가산)을 **`WipMatStockService.addStockInTx`(WIP_MAT_STOCKS 가산 + WIP_IN 거래)** 로 교체. 원자재창고 차감 + `STOCK_TRANSACTIONS` `WIP_MOVE`는 유지.

**Files:**
- Modify: `apps/backend/src/modules/material/services/mat-issue.service.ts`
- Modify: `apps/backend/src/modules/material/services/mat-issue.service.spec.ts`
- Modify: 모듈(WipMatStockService 주입)

- [ ] **Step 1: 테스트 수정** — 이동 시 `MAT_STOCKS`(원자재) 차감 + `STOCK_TRANSACTIONS` WIP_MOVE + **`WIP_MAT_STOCKS` 가산 + `WIP_MAT_TRANSACTIONS` WIP_IN** 검증으로 변경. (기존 MAT_STOCKS WIP 가산 검증은 제거)
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — `upsertWipStock` private 제거, `this.wipMatStockService.addStockInTx(qr, {equipCode: jobOrder.equipCode, itemCode, matUid, qty: issueQty, transType:'WIP_IN', fromWarehouseId: stock.warehouseCode, orderNo, refType:'MAT_ISSUE', refId:`${issueNo}-${seq}`, company, plant})` 호출. 원자재측 STOCK_TX WIP_MOVE 유지. orderNo/equipCode 없으면 기존 MAT_OUT.
- [ ] **Step 4: 통과** `jest mat-issue.service` → PASS, tsc 0
- [ ] **Step 5: Commit** `refactor(material): 출고 공정적재를 WIP_MAT_STOCKS로 전환`

---

## Task R4: mat-issue 이동취소 재작업 (Task 5 forward-fix)

WIP_MOVE 취소 시 **`WIP_MAT_STOCKS` 차감(`WipMatStockService.restoreInTx`, WIP_IN_CANCEL)** + 원자재창고 복원 + `STOCK_TRANSACTIONS` `WIP_MOVE_CANCEL`.

**Files:** `mat-issue.service.ts`, spec

- [ ] **Step 1: 테스트 수정** — WIP_MOVE 취소가 WIP_MAT_STOCKS 차감 + WIP_IN_CANCEL + 원자재 복원 + WIP_MOVE_CANCEL 검증.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — cancel 역분개 루프에서 원본 STOCK_TX가 WIP_MOVE면 원자재 복원 + WIP_MOVE_CANCEL 기록(기존), 추가로 `wipMatStockService.restoreInTx(...WIP_IN_CANCEL, deduct)`. 기존 MAT_STOCKS WIP 차감 코드 제거.
- [ ] **Step 4: 통과** `jest mat-issue.service`, tsc 0
- [ ] **Step 5: Commit** `refactor(material): 공정이동 취소를 WIP_MAT_STOCKS로 전환`

---

## Task R5: auto-issue 소비 재작업 (Task 6 forward-fix)

생산실적 완료 차감 대상을 `MAT_STOCKS`(WIP 창고) → **`WIP_MAT_STOCKS`(`WipMatStockService.deductStockInTx`, PROD_CONSUME)** 로 변경.

**Files:** `apps/backend/src/modules/production/services/auto-issue.service.ts`, spec, 모듈(주입)

- [ ] **Step 1: 테스트 수정** — 공정창고 MAT_STOCKS 차감 검증을 **WIP_MAT_STOCKS 차감 + WIP_MAT_TRANSACTIONS PROD_CONSUME** 검증으로 변경. 이중차감 방지(원자재 MAT_STOCKS 미변경) 검증 유지.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — issueFifo/deductMatStock의 차감을 `wipMatStockService.deductStockInTx({equipCode, itemCode, matUid/FIFO, qty, transType:'PROD_CONSUME', refType:'PROD_RESULT', refId:resultNo, orderNo, stockPolicy})`로. 스캔 LOT 우선순위는 WIP_MAT_STOCKS 내에서 적용. equipCode 없으면 기존 fallback(원자재 MAT_OUT) 유지.
- [ ] **Step 4: 통과** `jest auto-issue.service prod-result.service`, tsc 0
- [ ] **Step 5: Commit** `refactor(production): 생산소비를 WIP_MAT_STOCKS 차감으로 전환`

---

## Task R6: 소비취소 재작업 (Task 7 forward-fix)

생산실적 취소 시 `reverseAutoIssue`가 **`WIP_MAT_STOCKS` 복원(`restoreInTx`, PROD_CONSUME_CANCEL)**.

**Files:** `prod-result.service.ts`, spec

- [ ] **Step 1: 테스트 수정** — PROD_CONSUME 취소가 WIP_MAT_STOCKS 복원 + WIP_MAT_TRANSACTIONS PROD_CONSUME_CANCEL 검증. fallback(MAT_OUT→MAT_IN) 유지.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — reverseAutoIssue가 원본 거래를 `WIP_MAT_TRANSACTIONS`(PROD_CONSUME)에서 찾아 복원하도록 변경. (원본 조회 출처가 STOCK_TRANSACTIONS→WIP_MAT_TRANSACTIONS로 바뀜에 유의.) fallback 레거시는 유지.
- [ ] **Step 4: 통과** `jest prod-result.service auto-issue.service`, tsc 0
- [ ] **Step 5: Commit** `refactor(production): 생산소비 취소를 WIP_MAT_STOCKS 복원으로 전환`

---

## Task R7: 창고 경유 잔재 롤백 (Task 8 시드 + Task 3 헬퍼)

**Files:**
- Modify: `apps/backend/src/modules/inventory/services/warehouse.service.ts` (헬퍼 제거)
- Create: `apps/backend/src/migrations/2026-06-16_rollback_equip_wip_warehouse.sql`
- spec: warehouse.service.spec.ts(헬퍼 테스트 제거)

- [ ] **Step 1: getOrCreateEquipWipWarehouse 제거** — Task 3에서 추가한 헬퍼와 spec 테스트 제거(어디서도 호출 안 됨 확인 후). `getOrCreateFloorWarehouse`(원래 미사용)는 현상 유지.
- [ ] **Step 2: WIP 창고 시드 롤백 SQL**
```sql
-- Task 8에서 시드한 설비별 WIP 창고 행 삭제 (공정재고는 별도 테이블로 이관)
DELETE FROM WAREHOUSES WHERE WAREHOUSE_TYPE='WIP' AND WAREHOUSE_CODE LIKE 'WIP\_%' ESCAPE '\' AND EQUIP_CODE IS NOT NULL;
```
> `WIP_MAIN`(EQUIP_CODE NULL, 제품 WIP용)은 보존 — `EQUIP_CODE IS NOT NULL` 조건으로 제외.
- [ ] **Step 3: JSHANES 적용 + 검증**
```bash
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "DELETE FROM WAREHOUSES WHERE WAREHOUSE_TYPE='WIP' AND WAREHOUSE_CODE LIKE 'WIP\_%' ESCAPE '\' AND EQUIP_CODE IS NOT NULL"
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT COUNT(*) CNT FROM WAREHOUSES WHERE WAREHOUSE_TYPE='WIP' AND EQUIP_CODE IS NOT NULL"
```
기대: 삭제 후 CNT=0. (WIP_MAIN 등은 잔류)
> 주의: 삭제 전 해당 창고를 참조하는 MAT_STOCKS 행이 있으면(테스트 출고로 생성됐다면) 먼저 정리. 조회로 확인: `SELECT COUNT(*) FROM MAT_STOCKS WHERE WAREHOUSE_CODE LIKE 'WIP\_%' ESCAPE '\'`. 있으면 사용자 보고 후 처리.
- [ ] **Step 4: tsc + jest(warehouse.service)** → 0/PASS
- [ ] **Step 5: Commit** `refactor(inventory): 창고경유 WIP 잔재 롤백(헬퍼·시드 제거)`

---

## Task R8: 자재재고 화면 원자재 전용 복귀 (Task 9 롤백)

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/material/stock/page.tsx`
- Modify: `apps/backend/src/modules/material/dto/mat-stock.dto.ts`, `services/mat-stock.service.ts`, spec

- [ ] **Step 1: 백엔드 warehouseType 필터 제거** — Task 9에서 추가한 `StockQueryDto.warehouseType`, `resolveWarehouseTypeCodes`/`normalizeWarehouseType` 및 응답 warehouseType 가공 제거(또는 단순화). 단, 자재재고가 원자재창고만 보이도록(공정재고는 별도 화면). 관련 spec 2건 제거/수정.
- [ ] **Step 2: 프론트 필터 셀렉트·배지 제거** — Task 9 추가분 롤백, 원래 화면으로.
- [ ] **Step 3: 검증** 프론트/백엔드 tsc 0, `jest mat-stock.service` PASS
- [ ] **Step 4: Commit** `refactor(material): 자재재고 화면 원자재 전용 복귀(공정재고 분리)`

---

## Task R9: 공정재고 전용 화면 + 조회 API + 메뉴/i18n

**Files:**
- Create: `apps/backend/src/modules/inventory/controllers/wip-mat-stock.controller.ts` (또는 기존 컨트롤러에 추가) — `GET /inventory/wip-mat-stocks?equipCode=&search=`
- Create: `apps/frontend/src/app/(authenticated)/production/wip-material-stock/page.tsx`
- Modify: `apps/frontend/src/config/menuConfig.ts`, `apps/frontend/src/locales/{ko,en,zh,vi}.json`

- [ ] **Step 1: 백엔드 조회 API** — `WipMatStockService.findByEquip`/`findAll(query)`로 설비·품목·LOT·수량 반환(WAREHOUSES 아닌 EQUIP_MASTERS 조인해 설비명). 멀티테넌시. spec 1건.
- [ ] **Step 2: 프론트 화면** — `WIP_MAT_STOCKS` 목록을 설비별 그룹으로. `StatCard`(설비수/총수량). DataGrid 모달 `xl`+. 코드성 데이터 셀렉트. 파스텔 배경 금지.
- [ ] **Step 3: 메뉴 등록 + i18n** — menuConfig 생산관리(또는 자재관리) 하위 `wip-material-stock` 추가, 4-locale 라벨(공정재고/WIP Material Stock/工序物料库存/Tồn kho vật tư công đoạn). BOM 금지. 시드 필요 시 메뉴 시드 갱신.
- [ ] **Step 4: 검증** 프론트/백엔드 tsc 0, JSON 유효성, `jest` PASS
- [ ] **Step 5: Commit** `feat(production): 설비별 공정재고(WIP_MAT_STOCKS) 조회 화면`

---

## Task R10: 공정측 거래유형 i18n 라벨 보강

**Files:** `apps/frontend/src/locales/{ko,en,zh,vi}.json`

- [ ] **Step 1: 라벨 확인/추가** — 공정재고 화면/거래 표시에 쓰는 `WIP_IN`/`WIP_IN_CANCEL`/`PROD_CONSUME`/`PROD_CONSUME_CANCEL` 라벨이 4-locale에 있는지 확인(`prodConsume` 등 일부 Task 1에 존재). 없는 키만 add-only. BOM 금지.
- [ ] **Step 2: 검증** JSON 유효성+BOM, 프론트 tsc 0
- [ ] **Step 3: Commit** `feat(i18n): 공정재고 거래유형 라벨 보강`

---

## Task R11: 통합 검증 (JSHANES E2E)

**Files:** `docs/reports/wip-mat-stock-verify-2026-06-16.md`

- [ ] **Step 1: 빌드/타입** `pnpm build`(dev 서버면 `tsc --noEmit`) → 에러 0
- [ ] **Step 2: 시나리오 실측** (작업지시 1건, 설비 EQ-ATCNS-01)
  1. 자재출고 → `MAT_STOCKS` 원자재창고 차감 + `STOCK_TRANSACTIONS` WIP_MOVE 1건 + `WIP_MAT_STOCKS`(EQUIP_CODE=EQ-ATCNS-01) 가산 + `WIP_MAT_TRANSACTIONS` WIP_IN 1건.
  2. 생산실적 완료 → `WIP_MAT_STOCKS` 차감 + `WIP_MAT_TRANSACTIONS` PROD_CONSUME.
  3. 생산실적 취소 → WIP_MAT_STOCKS 복원 + PROD_CONSUME_CANCEL.
  4. 출고 취소 → WIP_MAT_STOCKS 차감 + 원자재 복원 + WIP_MOVE_CANCEL + WIP_IN_CANCEL.
  5. 이중차감 부재: 생산실적 시점 원자재 MAT_STOCKS 미변경.
  쿼리로 각 단계 확인(`WIP_MAT_STOCKS`, `WIP_MAT_TRANSACTIONS`, `STOCK_TRANSACTIONS`).
- [ ] **Step 3: 결과 기록 + Commit** `docs: 공정재고 별도테이블 통합 검증`

---

## 위험 / 주의
- **원본 거래 조회 출처 변경(R6)**: reverseAutoIssue가 STOCK_TRANSACTIONS가 아니라 WIP_MAT_TRANSACTIONS에서 PROD_CONSUME 원본을 찾아야 한다 — 누락 시 복원 실패.
- **롤백 전 잔존 데이터(R7)**: Task 4~8로 생성된 MAT_STOCKS WIP 행/WIP 창고를 삭제 전 확인. 테스트 출고분 있으면 정리.
- **이중차감 회귀(R5)**: auto-issue가 원자재 MAT_STOCKS를 건드리지 않는지 테스트 유지.
- **cutover**: 신규 출고부터 적용, 진행중 작업지시 소급 없음.
- **협업 보드**: LOCKS의 T-MAT-ISSUE-WIP-STOCK 파일 목록에 신규 2 엔티티/마이그/화면 추가 갱신.

## Self-Review
- 스펙 커버리지: 2테이블·채번(R1)·서비스(R2)·출고이동/취소(R3/R4)·소비/취소(R5/R6)·롤백(R7/R8)·화면(R9)·i18n(R10)·검증(R11) 매핑됨.
- 타입 일관성: `WipMatStockService.addStockInTx/deductStockInTx/restoreInTx/findByEquip` 명칭 R2 정의 ↔ R3~R6/R9 호출 일치. 거래유형 WIP_IN/WIP_IN_CANCEL/PROD_CONSUME/PROD_CONSUME_CANCEL 일관.
- 플레이스홀더: 채번 형식·메뉴 시드 등 "기존 패턴 확인 후 일치"로 실측 의존 명시.
