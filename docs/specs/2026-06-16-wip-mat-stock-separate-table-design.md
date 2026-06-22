# 공정재고 2단계 WIP — 별도 테이블 설계 (개정)

**일자:** 2026-06-16
**상태:** 설계 확정, forward-fix 방식으로 기존 작업 이어서 수정
**선행:** `docs/plans/2026-06-16-mat-issue-wip-stock.md` (창고 경유 방식 — 이 설계로 대체)

## 배경 / 변경 사유

자재출고를 "출고=소비"에서 "창고→공정 이동(적재) + 생산실적 완료 시 소비"의 2단계 WIP로 전환 중이었다. 1차 구현은 공정재고를 `MAT_STOCKS`에 `WIP_{equipCode}` 창고 행으로 적재(창고 경유)했으나, **공정재고를 물리적으로 별도 테이블**로 관리하기로 결정. 공정은 **설비(equipCode) 단위**로 움직이므로 공정재고도 설비 단위로 식별한다(라인은 참조정보).

## 핵심 결정 (확정)

1. 공정재고 = **설비(EQUIP_CODE) 단위 전용 테이블** `WIP_MAT_STOCKS`.
2. 공정 거래 = **전용 거래원장** `WIP_MAT_TRANSACTIONS`.
3. 원자재재고(`MAT_STOCKS`)·원자재 수불(`STOCK_TRANSACTIONS`)은 원자재 전용으로 유지.
4. 기존 main 커밋은 **forward-fix**(revert 없이 이어서 수정).
5. 공정재고 부족 시 정책: 기존 `MAT_ISSUE_STOCK_CHECK`(BLOCK/WARN) 재사용, 기본 WARN.

## 데이터 모델 (신규 2개 테이블)

### WIP_MAT_STOCKS (공정재고 잔량)
- PK: `(COMPANY, PLANT_CD, EQUIP_CODE, ITEM_CODE, MAT_UID)`
- 컬럼: `QTY` NUMBER, `AVAILABLE_QTY` NUMBER, `RESERVED_QTY` NUMBER DEFAULT 0, `CREATED_AT`/`UPDATED_AT` TIMESTAMP DEFAULT SYSTIMESTAMP
- LOT(matUid) 단위 추적 보존.

### WIP_MAT_TRANSACTIONS (공정재고 거래원장)
- PK: `TRANS_NO`
- 컬럼: `TRANS_TYPE` VARCHAR2(50), `EQUIP_CODE`, `ITEM_CODE`, `MAT_UID`, `QTY` NUMBER(+/−), `FROM_WAREHOUSE_ID`(이동 출처 원자재창고, nullable), `REF_TYPE`, `REF_ID`, `ORDER_NO`, `CANCEL_REF_ID`(nullable), `STATUS` DEFAULT 'DONE', `REMARK`, `WORKER_ID`(nullable), `COMPANY`, `PLANT_CD`, `CREATED_AT`/`UPDATED_AT` DEFAULT SYSTIMESTAMP
- 채번: 기존 채번 서비스 재사용(예: `WIP_TX` 시퀀스 신설 또는 `STOCK_TX` 재사용 — 구현 시 확정).

## 흐름과 거래유형

| 단계 | 원자재측 (`MAT_STOCKS` / `STOCK_TRANSACTIONS`) | 공정측 (`WIP_MAT_STOCKS` / `WIP_MAT_TRANSACTIONS`) |
|---|---|---|
| 출고(이동) | 원자재창고 차감 + `WIP_MOVE`(from=원자재창고, qty−) | 공정재고 가산 + `WIP_IN`(equip, qty+) |
| 출고취소 | 원자재창고 복원 + `WIP_MOVE_CANCEL`(qty+) | 공정재고 차감 + `WIP_IN_CANCEL`(qty−) |
| 소비(생산실적 완료) | — | 공정재고 차감 + `PROD_CONSUME`(equip, qty−) |
| 소비취소(실적 취소) | — | 공정재고 복원 + `PROD_CONSUME_CANCEL`(qty+) |

- 원자재측 거래유형 `WIP_MOVE`/`WIP_MOVE_CANCEL`: 이미 `TRANSACTION_TYPE_VALUES`에 추가됨(Task 1).
- 공정측 거래유형 `WIP_IN`/`WIP_IN_CANCEL`/`PROD_CONSUME`/`PROD_CONSUME_CANCEL`: 모두 기존 공통코드에 존재. (WIP_IN/WIP_IN_CANCEL은 제품 WIP에도 쓰이나, `WIP_MAT_TRANSACTIONS`는 별도 테이블이라 충돌 없음.)
- 적용 범위: 작업지시 연결 출고(수동 orderNo·PDA·출고요청)만 이동. 생산무관 일반출고는 기존 MAT_OUT 유지.

## 조회 화면

- **공정재고 전용 화면 신설(필수)**: `production/wip-material-stock` — `WIP_MAT_STOCKS`를 설비별로 조회. StatCard(설비수/총수량) + 설비 그룹 목록(설비·품목·LOT·수량).
- 자재재고 화면(`material/stock`)은 **원자재(`MAT_STOCKS`) 전용**으로 복귀 → Task 9 warehouseType 필터 롤백.
- 수불 화면(`inventory/transaction`)은 원자재 수불(`STOCK_TRANSACTIONS`) — `WIP_MOVE`/`WIP_MOVE_CANCEL` 라벨 유지(Task 11). 공정 거래원장 조회는 공정재고 화면에서 별도 제공(선택).

## 기존 작업 조정 (forward-fix)

| 기존 Task | 처리 |
|---|---|
| Task 1 (공통코드+i18n) | **유지** (WIP_MOVE/PROD_CONSUME). 공정측 라벨 WIP_IN 등 필요 시 보강 |
| Task 2 (WAREHOUSES.EQUIP_CODE) | **불필요** — 컬럼은 무해하나 사용 안 함. JSHANES 컬럼은 잔류 허용(제거 안 함) |
| Task 3 (getOrCreateEquipWipWarehouse) | **제거 또는 미사용 처리** |
| Task 4/5 (mat-issue 출고이동/취소) | **재작업**: 공정 가산/차감을 `WIP_MAT_STOCKS`+`WIP_MAT_TRANSACTIONS`로. 원자재측 `STOCK_TRANSACTIONS` WIP_MOVE는 유지 |
| Task 6/7 (auto-issue 소비/취소) | **재작업**: 차감/복원 대상을 `WIP_MAT_STOCKS`로, 거래는 `WIP_MAT_TRANSACTIONS` PROD_CONSUME |
| Task 8 (WIP 창고 46개 시드) | **롤백**: JSHANES `WAREHOUSES` WIP_* 46행 삭제 |
| Task 9 (자재재고 warehouseType 필터) | **롤백**: 원자재 전용 복귀 |
| Task 11 (수불 라벨) | **유지** |

## 신규 컴포넌트 (개정 후)

- 엔티티: `wip-mat-stock.entity.ts`, `wip-mat-transaction.entity.ts`
- 서비스: 공정재고 가산/차감 헬퍼(`WipMatStockService` 또는 mat-issue/auto-issue 내 헬퍼)
- 마이그레이션: 2테이블 생성 DDL + (롤백) WIP 창고 시드 삭제
- 화면: `production/wip-material-stock/page.tsx` + 메뉴/i18n
- 백엔드 조회 API: 공정재고 목록

## 미결/구현 시 확정
- `WIP_MAT_TRANSACTIONS` 채번 시퀀스(WIP_TX 신설 vs STOCK_TX 공유).
- 공정재고 전용 화면에 거래원장 조회 포함 여부(MVP는 잔량만).
- 전환 cutover: 진행중 작업지시의 미준비 자재 — 신규 출고부터 적용, 소급 없음.
