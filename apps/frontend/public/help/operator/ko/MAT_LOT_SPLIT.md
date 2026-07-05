---
menuCode: MAT_LOT_SPLIT
audience: operator
title: 자재분할 — 운영 가이드
summary: 자재분할 DB 구조(MAT_LOTS, MAT_STOCKS, STOCK_TRANSACTIONS), 입고완료 게이팅, 원본폐기→신규 2조각 발번 로직, origin 계승 추적, 멀티테넌시 스코프
tags: [자재, LOT, 분할, 운영, DB, 시리얼, 수불]
keywords: [로트분할, LOT 분할, MAT_LOTS, MAT_STOCKS, STOCK_TRANSACTIONS, MAT_UID, INIT_QTY, CURRENT_QTY, SPLIT, LOT_SPLIT_OUT, LOT_SPLIT_IN, 입고완료게이팅, RECEIVE, origin, nextMatSerial, STOCK_TX, isSplittable, InventoryFreezeGuard, 멀티테넌시, COMPANY, PLANT_CD]
related: [MAT_LOT, MAT_LOT_MERGE, MAT_ARRIVAL, MAT_ISSUE]
---

# 자재분할 — 운영 가이드

## 시스템 목적·역할
입고완료된 자재 LOT(`MAT_LOTS`) 시리얼 하나를 **두 개의 신규 시리얼로 분할**하는 화면입니다. 분할은 원본을 단순 분리하지 않고, **원본 시리얼을 폐기(STATUS='SPLIT', 재고 0)한 뒤 분할수량 조각·잔량 조각을 각각 새 시리얼로 발번**합니다. 모든 수량 이동은 `STOCK_TRANSACTIONS` 수불 원장에 `LOT_SPLIT_OUT`(원본 전량 출고) / `LOT_SPLIT_IN`(신규 조각 입고)으로 기록되며, 신규 LOT은 `ORIGIN`(최초 시리얼)을 계승해 추적성을 유지합니다.

> 설계 근거: `docs/specs/2026-06-08-lot-split-merge-redesign-design.md`. 원 시리얼 전부 폐기 → 결과 2조각 모두 신규 발번 방식.

## 데이터 구조
```
MAT_LOTS (PK: MAT_UID)                ← LOT 추적 마스터
  └─ MAT_STOCKS (PK: COMPANY+PLANT_CD+WAREHOUSE_CODE+ITEM_CODE+MAT_UID)
        QTY / AVAILABLE_QTY / RESERVED_QTY   ← 현재고

분할 실행 시 (단일 트랜잭션):
  원본 MAT_UID
    STATUS NORMAL → SPLIT, CURRENT_QTY → 0
    MAT_STOCKS QTY/AVAILABLE_QTY → 0
    STOCK_TRANSACTIONS: LOT_SPLIT_OUT (QTY = -전량)
  신규 시리얼 A(분할수량), B(잔량)  ← nextMatSerial 발번
    MAT_LOTS 신규 INSERT (ORIGIN 계승)
    MAT_STOCKS 신규 INSERT
    STOCK_TRANSACTIONS: LOT_SPLIT_IN (QTY = +조각수량) × 2

입고완료 게이팅:
  Σ STOCK_TRANSACTIONS.QTY (TRANS_TYPE IN RECEIVE/LOT_SPLIT_IN/LOT_MERGE_IN, STATUS<>CANCELED)
    >= MAT_LOTS.INIT_QTY
```

---

## ① 분할 가능 LOT 그리드 — MAT_LOTS / MAT_STOCKS

목록 쿼리는 `MAT_LOTS`와 `MAT_STOCKS`를 INNER JOIN하고 입고완료 게이팅을 적용한 결과입니다.

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 자재시리얼 | `MAT_LOTS.MAT_UID` | PK. LOT의 유일 식별자(라벨 바코드). 분할 대상 원본 시리얼. |
| 품목코드 | `MAT_LOTS.ITEM_CODE` | `ITEM_MASTERS.ITEM_CODE` 참조. 품목명·단위 조인 키. |
| 품목명 | `ITEM_MASTERS.ITEM_NAME` | `PartMaster`에서 `ITEM_CODE`로 조인. 화면 표시용. |
| 현재수량 | `MAT_STOCKS.QTY` | 현재고. 목록 조건 `QTY > 1`. 분할수량은 이 값 미만이어야 함. |
| 단위 | `ITEM_MASTERS.UNIT` | 품목마스터의 단위. 수량 옆 표시. |
| 공급처 | `MAT_LOTS.VENDOR` → `PARTNER_MASTERS.PARTNER_NAME` | `VENDOR`(거래처 코드)로 `PartnerMaster` 일괄 조인(N+1 회피). 미매핑 시 코드 표시. |
| (게이팅) | `MAT_LOTS.INIT_QTY` vs Σ수불 | 화면 비표시. 입고완료 판정 기준값. |
| (목록 필터) | `MAT_LOTS.STATUS = 'NORMAL'` | NORMAL만. SPLIT/MERGED/HOLD/DEPLETED 제외. |
| (목록 필터) | `MAT_STOCKS.RESERVED_QTY = 0` | 예약 수량이 있으면 목록 제외. |

> 목록 조건 종합: `MAT_STOCKS.QTY > 1` AND `MAT_LOTS.STATUS = 'NORMAL'` AND `NVL(RESERVED_QTY,0) = 0` AND 입고완료 게이팅 통과.

---

## ② 자재 LOT — MAT_LOTS (분할 관련 전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 자재 UID | `MAT_UID` | PK(varchar2 50). 신규 조각은 `nextMatSerial`로 채번. |
| 품목코드 | `ITEM_CODE` | 신규 조각은 원본 계승. |
| 초기수량 | `INIT_QTY` | 발급 시 원수량(불변). 입고완료 게이팅 비교 대상. 신규 조각은 조각 수량으로 INSERT. |
| 현재수량 | `CURRENT_QTY` | 잔량. 원본은 분할 시 `0`으로 갱신. 신규 조각은 조각 수량. |
| 입고일 | `RECV_DATE` | 신규 조각은 원본 계승. |
| 제조일 | `MANUFACTURE_DATE` | 신규 조각은 원본 계승. |
| 유효기한 | `EXPIRE_DATE` | 신규 조각은 원본 계승. |
| 입하번호 | `ARRIVAL_NO` | 신규 조각은 원본 계승. 라벨·역추적에 사용. |
| 입하 SEQ | `ARRIVAL_SEQ` | 신규 조각은 원본 계승. |
| 원산지(최초시리얼) | `ORIGIN` | 분할·병합 추적 키. 원본의 `ORIGIN`(없으면 원본 `MAT_UID`)을 두 조각에 계승. genealogy 핵심. |
| 거래처 | `VENDOR` | 공급처 코드. 신규 조각 계승. |
| 제조사 코드 | `MFG_PARTNER_CODE` | 신규 조각 계승. 라벨 제조사로 출력(원본 제조사 계승). |
| 인보이스번호 | `INVOICE_NO` | 신규 조각 계승. |
| PO번호 | `PO_NO` | 신규 조각 계승. |
| IQC 상태 | `IQC_STATUS` | 신규 조각 계승(이미 통과한 검사 결과 유지). |
| 특채여부 | `SPECIAL_ACCEPT_YN` | 기본 `N`. |
| LOT 상태 | `STATUS` | 원본은 분할 후 `SPLIT`. 신규 조각은 `NORMAL`. 분할 가능 상태는 `NORMAL`만. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | `'40'` / `'1000'` 스코프. 신규 조각 계승. |

---

## ③ 원자재 재고 — MAT_STOCKS

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | PK(복합) 일부. |
| 창고코드 | `WAREHOUSE_CODE` | PK(복합). 신규 조각은 원본 창고 계승. |
| 품목코드 | `ITEM_CODE` | PK(복합). |
| 자재 UID | `MAT_UID` | PK(복합). 신규 조각은 새 시리얼로 신규 행. |
| 로케이션 | `LOCATION_CODE` | 신규 조각은 원본 계승. |
| 수량 | `QTY` | 총수량. 원본은 분할 시 `0`. 신규 조각은 조각 수량. |
| 예약수량 | `RESERVED_QTY` | 분할 차단 조건(`> 0`이면 불가). 신규 조각은 0. |
| 가용수량 | `AVAILABLE_QTY` | 원본은 분할 시 `0`. 신규 조각은 조각 수량. |

---

## ④ 수불 원장 — STOCK_TRANSACTIONS

분할 1건당 `LOT_SPLIT_OUT` 1행 + `LOT_SPLIT_IN` 2행이 생성됩니다.

| DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|
| `TRANS_NO` | PK. `NumberingService.next('STOCK_TX')`로 채번. |
| `TRANS_TYPE` | `LOT_SPLIT_OUT`(원본 전량 출고, QTY 음수) / `LOT_SPLIT_IN`(신규 조각 입고, QTY 양수). |
| `TRANS_DATE` | 트랜잭션 발생 일시. |
| `FROM_WAREHOUSE_ID` | OUT 트랜잭션의 출고 창고(원본 창고). |
| `TO_WAREHOUSE_ID` | IN 트랜잭션의 입고 창고(원본 창고 계승). |
| `ITEM_CODE` | 품목코드(원본 계승). |
| `MAT_UID` | OUT은 원본 시리얼, IN은 신규 조각 시리얼. |
| `QTY` | OUT은 `-전량`, IN은 `+조각수량`. INT. |
| `REF_TYPE` | `LOT_SPLIT`. |
| `REF_ID` | 원본 `MAT_UID`(분할 추적 참조). |
| `REMARK` | 비고 또는 자동 생성 `자재분할: {원본}({전량}) → {분할수량} + {잔량}`. |
| `WORKER_ID` | 처리 사용자. |
| `STATUS` | `DONE`. 입고완료 게이팅 합산 시 `STATUS <> 'CANCELED'` 조건. |
| `COMPANY`, `PLANT_CD` | 멀티테넌시 스코프. |

> 입고완료 게이팅은 `RECEIVE` 외에 `LOT_SPLIT_IN` / `LOT_MERGE_IN`도 입고로 인정합니다. 따라서 분할·병합 결과 시리얼도 재분할·재병합이 가능합니다.

---

## 분할 실행 로직 (split)

단일 DB 트랜잭션(`TransactionService.run`) 내에서 순서대로 실행합니다.

1. 원본 LOT 조회(테넌트 스코프) + 존재·테넌트 일치 검증.
2. 상태 검증: `STATUS = 'NORMAL'`만 허용(`HOLD`/기타는 차단).
3. **입고완료 게이팅**: Σ`STOCK_TRANSACTIONS.QTY`(RECEIVE/LOT_SPLIT_IN/LOT_MERGE_IN, STATUS<>CANCELED) ≥ `INIT_QTY`.
4. 원본 재고(`MAT_STOCKS`) 조회: `QTY > 0`, `RESERVED_QTY = 0`, `splitQty < QTY` 검증.
5. 출고 이력(`MAT_ISSUES`) 검증: CANCELED 외 출고 이력이 있으면 차단.
6. 품목(`PartMaster`) 검증: `IS_SPLITTABLE = 'N'`이면 분할 불가.
7. `LOT_SPLIT_OUT` 수불 생성(QTY = `-전량`).
8. 원본 폐기: `MAT_LOTS.STATUS = 'SPLIT'`, `CURRENT_QTY = 0`; `MAT_STOCKS.QTY = AVAILABLE_QTY = 0`.
9. 두 조각(`[splitQty, remainQty]`) 각각:
   - `nextMatSerial`로 신규 시리얼 채번.
   - `MAT_LOTS` 신규 INSERT(원본 속성·`ORIGIN` 계승, `STATUS = 'NORMAL'`).
   - `MAT_STOCKS` 신규 INSERT.
   - `LOT_SPLIT_IN` 수불 생성(QTY = `+조각수량`).
10. 응답에 `label`(신규 시리얼 2건) 포함 → 프론트가 라벨 미리보기 출력.

> `remainQty = totalQty - splitQty`이며, `splitQty < QTY` 검증으로 항상 `> 0`이 보장됩니다.

---

## 사전 설정 (마스터·공통코드)

- 대상 LOT이 **입고완료**(입고처리까지 끝나 `STOCK_TRANSACTIONS`에 RECEIVE 합 ≥ INIT_QTY) 상태여야 합니다.
- 품목마스터(`ITEM_MASTERS`)의 `IS_SPLITTABLE`이 `N`이면 분할 불가 — 분할 허용 품목은 `Y`로 설정.
- 채번 키 사전 등록: 자재 시리얼(`nextMatSerial`, 일별 시퀀스 `VH1-RM...`), 수불 트랜잭션(`STOCK_TX`).
- `InventoryFreezeGuard` — 재고 마감(freeze) 기간에는 분할 POST가 차단됩니다.

---

## 운영 절차

1. 분할 대상 LOT이 입고완료·NORMAL·예약/출고 이력 없음 상태인지 확인.
2. 분할 버튼 → 분할수량 입력(현재수량 미만) → 분할 실행.
3. 라벨 미리보기에서 신규 시리얼 2건 라벨 출력, 원본 라벨 폐기.
4. 분할 후 `MAT_LOTS`에서 원본 `STATUS = 'SPLIT'`, 신규 2건 `NORMAL` 확인.

---

## 권한

| 역할 | 허용 작업 |
|------|------|
| 일반 사용자 | 분할 가능 LOT 조회, 분할 실행, 라벨 출력 |
| 물류/자재 담당자 | 위 동일 |
| 운영자/관리자 | 위 + 재고 마감(freeze) 설정·해제, 품목 `IS_SPLITTABLE` 설정 |

---

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| LOT이 목록에 안 보임 | 입고완료 전 / `QTY <= 1` / `RESERVED_QTY > 0` / `STATUS <> NORMAL` | [원자재 LOT현황]에서 상태·수량·예약 확인. 입고처리 선행 |
| "입고완료된 LOT만 분할" 오류 | 게이팅 미통과(RECEIVE 합 < INIT_QTY) | 입고확정(입고처리)을 먼저 진행 |
| "정상(NORMAL) 상태가 아닌 LOT" 오류 | 이미 SPLIT/MERGED이거나 HOLD | 다른 LOT 선택. 보류는 해제 후 진행 |
| "예약 수량이 있는 LOT" 오류 | `RESERVED_QTY > 0` | 예약을 먼저 정리(취소/소진) |
| "이미 자재출고 이력이 있는 LOT" 오류 | CANCELED 외 출고 이력 존재 | 출고를 먼저 정리하거나 다른 LOT 사용 |
| "해당 품목은 분할할 수 없습니다" 오류 | `ITEM_MASTERS.IS_SPLITTABLE = 'N'` | 품목마스터에서 분할 허용으로 변경 |
| "분할 수량은 현재 재고보다 작아야" 오류 | `splitQty >= QTY` | 현재수량 미만으로 재입력 |
| 분할 POST가 막힘(freeze) | 재고 마감 기간 | `InventoryFreezeGuard` 마감 해제 후 재시도 |
| 라벨이 출력 안 됨 | Print Agent 미실행 | 로컬 Print Agent 실행 상태 확인 |

---

## 데이터·연계

| 항목 | 내용 |
|------|------|
| 주요 테이블 | `MAT_LOTS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS` |
| 검증 참조 | `MAT_ISSUES`(출고 이력), `ITEM_MASTERS`(IS_SPLITTABLE·단위), `PARTNER_MASTERS`(공급처명) |
| API 경로 | `GET /material/lot-split`(분할 가능 목록), `POST /material/lot-split`(분할 실행) |
| 채번 | 시리얼 `nextMatSerial`(SEQ_MAT_SERIAL_DAILY), 수불 `STOCK_TX` (`NumberingService`) |
| 가드 | `InventoryFreezeGuard`(POST) |
| 추적(genealogy) | `ORIGIN`(최초 시리얼) 계승 + `STOCK_TRANSACTIONS.REF_ID`(원본 MAT_UID) |
| 연계 화면 | 입하관리(LOT 발급), 자재병합(역연산), 원자재 LOT현황, 자재출고 |
| 멀티테넌시 스코프 | `COMPANY = '40'`, `PLANT_CD = '1000'` — 모든 조회·저장 시 공통 필터 |
