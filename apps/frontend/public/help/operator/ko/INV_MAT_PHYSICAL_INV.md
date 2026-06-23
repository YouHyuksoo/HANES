---
menuCode: INV_MAT_PHYSICAL_INV
audience: operator
title: 자재재고실사 관리 — 운영 가이드
summary: PHYSICAL_INV_SESSIONS + COUNT_DETAILS 전체 컬럼, 실사 프로세스(세션→스캔→반영), 재고 동결 메커니즘
tags: [재고, 실사, 운영, 세션, 동결]
keywords: [PHYSICAL_INV_SESSIONS, PHYSICAL_INV_COUNT_DETAILS, 재고실사, IN_PROGRESS, InventoryFreezeGuard, PDA스캔, 세션개시, 세션종료, 실사반영, MAT_STOCKS]
related: [INV_MAT_PHYSICAL_INV_APPLY, INV_MAT_STOCK, MAT_ADJUSTMENT]
---

# 자재재고실사 관리 — 운영 가이드

## 시스템 목적·역할
실제 창고 재고와 시스템 재고의 차이를 찾기 위해 **재고실사(Physical Inventory)** 세션을 관리합니다. 실사 세션을 개시하면 해당 창고의 재고 트랜잭션이 차단되고(`InventoryFreezeGuard`), PDA에서 품목별 실사 수량을 스캔할 수 있습니다. 세션 완료 후 실사 결과를 재고에 반영합니다.

## 데이터 구조
```
PHYSICAL_INV_SESSIONS (PK: SESSION_DATE + SEQ)
    │
    ├── STATUS: IN_PROGRESS → COMPLETED
    ├── INV_TYPE: MATERIAL / PRODUCT
    │
    └──▶ PHYSICAL_INV_COUNT_DETAILS (PK: SESSION_DATE + SEQ + WAREHOUSE_CODE + ITEM_CODE + MAT_UID)
            │
            ├── SYSTEM_QTY (개시 시점 스냅샷)
            ├── COUNTED_QTY (PDA 누적 스캔)
            └──▶ 반영 시 → MAT_STOCKS 업데이트 + STOCK_TRANSACTIONS + INV_ADJ_LOGS
```

---

## ① 실사 세션 — PHYSICAL_INV_SESSIONS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 세션일자 | `SESSION_DATE` | **PK (1/2)**. 세션 생성일. 자동 생성(`SYSDATE`). |
| 일련번호 | `SEQ` | **PK (2/2)**. 시퀀스 채번. |
| 실사구분 | `INV_TYPE` | `MATERIAL`(자재) / `PRODUCT`(제품). |
| 상태 | `STATUS` | `IN_PROGRESS`(진행중) / `COMPLETED`(완료) / `CANCELLED`(취소). |
| 기준년월 | `COUNT_MONTH` | 실사 대상 월. `YYYY-MM` 형식. |
| 창고코드 | `WAREHOUSE_CODE` | 실사 대상 창고(NULL=전체). |
| 회사 | `COMPANY` | 멀티테넌시. |
| 사업장 | `PLANT_CD` | 멀티테넌시. |
| 개시자 | `STARTED_BY` | 세션 개시 사용자. |
| 완료자 | `COMPLETED_BY` | 세션 완료 사용자. |
| 완료일시 | `COMPLETED_AT` | 세션 완료 시각. |
| 비고 | `REMARK` | 메모. |
| 생성일시 | `CREATED_AT` | 레코드 생성 시각. |
| 수정일시 | `UPDATED_AT` | 레코드 수정 시각. |

---

## ② 실사 상세 — PHYSICAL_INV_COUNT_DETAILS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 세션일자 | `SESSION_DATE` | **PK (1/5)**. 상위 세션 참조. |
| 세션SEQ | `SEQ` | **PK (2/5)**. 상위 세션 참조. |
| 창고코드 | `WAREHOUSE_CODE` | **PK (3/5)**. |
| 품목코드 | `ITEM_CODE` | **PK (4/5)**. |
| 자재시리얼 | `MAT_UID` | **PK (5/5)**. LOT 시리얼. |
| 로케이션코드 | `LOCATION_CODE` | PDA 스캔 시 로케이션. |
| 시스템수량 | `SYSTEM_QTY` | 세션 개시 시점의 시스템 재고 수량 스냅샷. |
| 실사수량 | `COUNTED_QTY` | PDA에서 누적 스캔한 실사 수량. |
| 스캔사용자 | `COUNTED_BY` | 마지막 스캔 사용자. |
| 실제로케이션 | `ACTUAL_LOCATION` | 확인된 실제 적치 위치(보정용). |
| 비고 | `REMARK` | 메모. |
| 생성일시 | `CREATED_AT` | |
| 수정일시 | `UPDATED_AT` | |

---

## 재고 동결(Freeze) 메커니즘

실사 세션이 `IN_PROGRESS` 상태인 동안 `InventoryFreezeGuard`가 적용되어 다음 트랜잭션이 차단됩니다:

| 차단 대상 | 상세 |
|----------|------|
| 자재입고 | `POST /material/receiving` |
| 자재출고 | `POST /material/issue` |
| 재고보정 | `POST /material/adjustment` |
| LOT 분할/병합 | 관련 API |
| 재고이동 | 관련 API |

> 동결은 `PHYSICAL_INV_SESSIONS`에 `IN_PROGRESS` 행이 존재하는지 확인하여 동작합니다. 세션 완료 또는 취소 시 자동 해제됩니다.

---

## 실사 전체 프로세스

```
1. [PC] 세션 개시 → POST /material/physical-inv/session/start
    → PHYSICAL_INV_SESSIONS INSERT (IN_PROGRESS)
    → 재고 트랜잭션 차단 시작

2. [PDA] 현장 스캔 → POST /material/physical-inv/count
    → PHYSICAL_INV_COUNT_DETAILS UPSERT (countedQty 누적 +1)
    → 반복 스캔하여 실사 수량 누적

3. [PC] 세션 종료 → POST /material/physical-inv/session/:date/:seq/complete
    → PHYSICAL_INV_SESSIONS UPDATE (COMPLETED)
    → 재고 트랜잭션 차단 해제

4. [PC] 실사 반영 → POST /material/physical-inv
    → MAT_STOCKS.qty 업데이트
    → STOCK_TRANSACTIONS (PHYSCOUNT_IN/OUT)
    → INV_ADJ_LOGS (PHYSICAL_COUNT)
```

---

## 권한
재고실사 관리 권한이 있는 사용자(자재/품질 관리자). PDA 스캔은 현장 작업자.

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| "이미 진행 중인 세션이 있습니다" 오류 | 동일한 IN_PROGRESS 세션이 이미 존재 | 기존 세션 완료 후 다시 개시 |
| 입고/출고/보정이 안 됨(403) | 실사 세션이 IN_PROGRESS 상태 | 실사 종료 또는 취소 |
| PDA 스캔이 안 됨 | 활성 세션이 없거나 세션에 해당 창고가 없음 | 세션 개시 확인 및 창고 일치 여부 확인 |
| 실사수량이 0으로 표시됨 | PDA에서 아직 스캔 안 함 또는 UPSERT 실패 | PDA 연결 상태 확인 후 재스캔 |
| 차이 컬럼이 계산 안 됨 | `countedQty`가 NULL | PDA 스캔 완료 후 새로고침 |

## 데이터·연계
- **테이블**: `PHYSICAL_INV_SESSIONS`, `PHYSICAL_INV_COUNT_DETAILS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS`, `INV_ADJ_LOGS`
- **연계**: PDA 연동(POST /count), 실사반영(Apply) 페이지, 재고동결(InventoryFreezeGuard)
- **스코프**: `COMPANY='40'`, `PLANT_CD='1000'`
