---
menuCode: MAT_ADJUSTMENT
audience: operator
title: 재고보정 — 운영 가이드
summary: 재고보정의 전체 컬럼 의미, DB 매핑, 승인 프로세스(PDA 2단계), 재고 연동 구조와 트러블슈팅
tags: [자재, 재고, 보정, 운영, 설정, 실사]
keywords: [INV_ADJ_LOGS, MAT_STOCKS, 재고보정, 재고실사, ADJ_TYPE, PHYSICAL_INV, MANUAL_ADJ, 보정승인, PENDING, APPROVED, InventoryFreezeGuard, STOCK_TRANSACTIONS, MAT_LOTS, 창고재고]
related: [MAT_RECEIVE, MAT_ISSUE]
---

# 재고보정 — 운영 가이드

## 시스템 목적·역할
실물 재고와 시스템 재고 간 차이가 발생했을 때 이를 수동으로 정정하고 그 이력을 `INV_ADJ_LOGS`에 기록합니다. 보정이 발생하면 `MAT_STOCKS`(창고별 품목 재고)의 수량이 변경되고 `STOCK_TRANSACTIONS`에 ADJUST_IN/ADJUST_OUT 트랜잭션이 기록됩니다. PDA 경로(2단계 승인)와 PC 경로(즉시 승인)로 나뉩니다.

## 데이터 구조
```
INV_ADJ_LOGS  (PK: ADJ_DATE + SEQ)
    │
    ├── 승인(APPROVED) 시 ──▶ MAT_STOCKS.qty 업데이트
    │                           │
    │                           └── STOCK_TRANSACTIONS (ADJUST_IN / ADJUST_OUT)
    │
    └── PENDING 상태 ──▶ 승인/반려 대기 (PDA 등록)
                            │
                            ├── 승인 → MAT_STOCKS 반영
                            └── 반려 → 이력만 남고 재고 변동 없음
```

---

## ① 재고보정 — INV_ADJ_LOGS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 조정일자 | `ADJ_DATE` | **PK (1/2)**. 보정 등록일자. 자동 생성(`SYSDATE`). |
| 일련번호 | `SEQ` | **PK (2/2)**. 동일 일자 내 순번. 자동 채번(시퀀스 또는 `MAX+1`). |
| 창고 | `WAREHOUSE_CODE` | 보정 대상 창고. `MAT_STOCKS.WAREHOUSE_CODE`와 연결. |
| 품목코드 | `ITEM_CODE` | 보정 대상 품목. `ITEM_MASTERS.ITEM_CODE` 참조. |
| 자재 UID | `MAT_UID` | LOT 단위 보정 시 LOT UID. NULL이면 품목 전체 보정. |
| 보정유형 | `ADJ_TYPE` | 보정 구분: `ADJUST`(일반보정), `PHYSICAL_INV`(실사), `MANUAL_ADJ`(수동조정). |
| 보정전 수량 | `BEFORE_QTY` | 보정 전 시스템 재고 수량. `MAT_STOCKS.QTY` 기준. |
| 보정후 수량 | `AFTER_QTY` | 보정 후 최종 수량. |
| 차이 수량 | `DIFF_QTY` | `AFTER_QTY - BEFORE_QTY`. 양수=증가, 음수=감소. |
| 승인상태 | `ADJUST_STATUS` | `PENDING` = 승인대기(PDA 경로), `APPROVED` = 승인완료(재고 반영됨), `REJECTED` = 반려. PC 경로는 기본 `APPROVED`. |
| 보정 사유 | `REASON` | 보정 이유. `varchar2(500)`. |
| 승인자 | `APPROVED_BY` | 승인/반려 처리자 ID. |
| 승인일시 | `APPROVED_AT` | 승인/반려 처리 시각. |
| 작성자 | `CREATED_BY` | 보정 등록자. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | 회사코드(`40`) / 플랜트코드(`1000`) 스코프. |
| 수정자 | `UPDATED_BY` | 최종 수정자. |
| 최초생성일 | `CREATED_AT` | 보정 등록 시각. 목록에 표시됨. |
| 최종수정일 | `UPDATED_AT` | 최종 수정 시각(자동). |

---

## 보정 유형 (`ADJ_TYPE`)

| 코드 | 의미 | 사용처 |
|------|------|------|
| `ADJUST` | 일반 보정 | PC 화면에서 직접 수량 보정 |
| `PHYSICAL_INV` | 실사 보정 | 재고 실사 결과 반영 |
| `MANUAL_ADJ` | 수동 조정 | 입출고 오류 정정 등 예외 케이스 |

---

## 승인 프로세스 (2경로)

| 경로 | 등록 방식 | 초기 상태 | 재고 반영 | 사용처 |
|------|----------|-----------|----------|--------|
| PC 화면 | `POST /material/adjustment` | `APPROVED` | **즉시 반영** | 사무실 PC |
| PDA | `POST /material/adjustment/pending` | `PENDING` | 승인 시 반영 | 현장 PDA |

**PENDING → 승인/반려 플로우:**
1. PDA에서 `POST /material/adjustment/pending`으로 등록 → `ADJUST_STATUS = 'PENDING'` (재고 미반영)
2. 관리자가 `PATCH /material/adjustment/:adjDate/:seq/approve` → 승인 → `MAT_STOCKS.qty` 업데이트 + `STOCK_TRANSACTIONS` 기록
3. 또는 `PATCH /material/adjustment/:adjDate/:seq/reject` → 반려 → 이력만 남고 재고 변동 없음

> `InventoryFreezeGuard`가 적용되어 재고 동결(Freeze) 상태에서는 보정 등록/승인이 차단됩니다.

---

## 재고 연동 상세

**승인 시 실행되는 처리 순서:**
1. `MAT_STOCKS`에서 해당 창고+품목+LOT의 현재 `QTY` 조회
2. `DIFF_QTY`만큼 `MAT_STOCKS.QTY` 증감
3. `STOCK_TRANSACTIONS`에 `ADJUST_IN`(증가) 또는 `ADJUST_OUT`(감소) 트랜잭션 기록
4. `INV_ADJ_LOGS.ADJUST_STATUS`를 `'APPROVED'`로 갱신 + 승인자·승인일시 기록

---

## 운영 절차
1. **실사 또는 차이 발견**: 창고 재고 실사 후 시스템과 실제 수량 차이 확인
2. **보정 등록**: PC 화면에서 창고·품목·보정후수량·사유 입력 → 즉시 반영
3. **PDA 경로(현장)**: PDA에서 PENDING 등록 → 관리자가 승인/반려
4. **결과 확인**: DataGrid에서 보정 이력과 증감 내역 확인
5. **반대 보정(오류 시)**: 잘못 등록 시 반대 방향 보정으로 원상복구

## 권한
재고 보정 권한이 있는 사용자(자재/생산 관리자). `InventoryFreezeGuard`에 의해 재고 동결 기간 중에는 등록·승인 불가.

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| 저장 버튼 비활성화 | 창고·품목·수량·사유 중 빈 값 있음 | 필수 필드 모두 입력 |
| "재고 동결 중" 오류 | 재고 실사 등으로 재고 동결 상태 | 동결 해제 후 재시도 |
| 보정 후 수량이 이상함 | 보정후 수량을 증감량이 아닌 최종값으로 입력해야 함 | 보정후 수량 입력 확인 (차이가 아닌 최종값) |
| PDA 등록 건이 승인 안 됨 | `ADJUST_STATUS = 'PENDING'` 상태로 남아 있음 | 승인(`/approve`) 또는 반려(`/reject`) 처리 |
| 수량이 음수로 표시됨 | 재고 부족 상태에서 감소 보정 | 재고 수량 확인 후 적절한 값으로 재보정 |

## 데이터·연계
- **테이블**: `INV_ADJ_LOGS` (보정 이력), `MAT_STOCKS` (재고 수량 갱신), `STOCK_TRANSACTIONS` (거래 이력), `MAT_LOTS` (LOT 정보)
- **연계**: `ITEM_MASTERS`(품목), `WAREHOUSES`(창고)
- **스코프**: `COMPANY='40'`, `PLANT_CD='1000'`
- **보호 장치**: `InventoryFreezeGuard` — 재고 동결 상태에서 보정 차단
