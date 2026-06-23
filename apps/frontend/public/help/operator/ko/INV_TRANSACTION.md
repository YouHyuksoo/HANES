---
menuCode: INV_TRANSACTION
audience: operator
title: 자재수불이력조회 — 운영 가이드
summary: STOCK_TRANSACTIONS 전체 컬럼, 거래유형별 의미, 취소 체인 구조와 트러블슈팅
tags: [재고, 수불, 운영, 조회, 트랜잭션]
keywords: [STOCK_TRANSACTIONS, TRANS_TYPE, TRANS_NO, CANCEL_REF_ID, 수불이력, RECEIVE, MAT_OUT, ADJUST, TRANSFER, SCRAP]
related: [INV_MAT_STOCK, MAT_ADJUSTMENT]
---

# 자재수불이력조회 — 운영 가이드

## 시스템 목적·역할
`STOCK_TRANSACTIONS` 테이블에 기록된 모든 자재 재고 변동 내역을 조회합니다. 입고·출고·이동·보정·폐기 등 모든 수불 내역을 유형별·일자별로 추적 가능하며, 취소 시에는 원본 트랜잭션과 취소 트랜잭션이 `CANCEL_REF_ID`로 연결됩니다.

## 데이터 구조
```
STOCK_TRANSACTIONS (PK: TRANS_NO)
    │
    ├── 기본정보: TRANS_TYPE, TRANS_DATE, QTY, STATUS
    ├── 창고: FROM_WAREHOUSE_ID → WAREHOUSES, TO_WAREHOUSE_ID → WAREHOUSES
    ├── 품목/LOT: ITEM_CODE → ITEM_MASTERS, MAT_UID → MAT_LOTS
    ├── 참조: REF_TYPE + REF_ID (발주/작업지시 등 원본 참조)
    └── 취소체인: CANCEL_REF_ID → STOCK_TRANSACTIONS.TRANS_NO (자기참조)
        └── 취소 원본을 찾을 때 CANCEL_REF_ID로 역추적
```

---

## ① 수불이력 — STOCK_TRANSACTIONS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 트랜잭션번호 | `TRANS_NO` | **PK**. 자연키. 채번 규칙에 따라 생성. |
| 거래유형 | `TRANS_TYPE` | 수불 구분. `RECEIVE`, `MAT_OUT`, `ADJUST_IN`, `TRANSFER` 등. 화면에서 컬러칩 표시. |
| 거래일시 | `TRANS_DATE` | 트랜잭션 처리 시각. 기본값 `CURRENT_TIMESTAMP`. |
| 출고창고 | `FROM_WAREHOUSE_ID` | 재고가 감소한 창고(출고·이동 시). NULL이면 단순 입고. |
| 입고창고 | `TO_WAREHOUSE_ID` | 재고가 증가한 창고(입고·이동 시). NULL이면 단순 출고. |
| 품목코드 | `ITEM_CODE` | 변동 품목. `ITEM_MASTERS.ITEM_CODE` 참조. |
| LOT번호 | `MAT_UID` | LOT 단위 트랜잭션 시 시리얼번호. NULL이면 수량 기준 처리. |
| 수량 | `QTY` | 변동 수량. 양수=재고증가(입고), 음수=재고감소(출고). |
| 단가 | `UNIT_PRICE` | 품목 단가(입고 시). |
| 금액 | `TOTAL_AMOUNT` | 총 금액(= QTY × UNIT_PRICE). |
| 참조유형 | `REF_TYPE` | 원본 문서 유형. `JOB_ORDER`, `SUBCON_ORDER`, `PO` 등. |
| 참조ID | `REF_ID` | 원본 문서 번호. |
| 취소참조 | `CANCEL_REF_ID` | 이 트랜잭션이 취소라면 원본 `TRANS_NO`. NULL이면 정상 트랜잭션. |
| 작업자 | `WORKER_NO` | 작업자 ID. |
| 비고 | `REMARK` | 추가 메모. |
| 상태 | `STATUS` | `DONE`(정상) / `CANCELED`(취소됨). 기본 `DONE`. |
| 재고계정 | `ACCOUNT` | 공통코드 기반 재고 계정 구분. |
| 승인자 | `APPROVER_ID` | 기타출고 등 승인 필요 트랜잭션의 승인자. |
| 승인일시 | `APPROVED_AT` | 승인 처리 시각. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | 회사코드(`40`) / 플랜트코드(`1000`) 스코프. |
| 생성자 | `CREATED_BY` | 등록자. |
| 수정자 | `UPDATED_BY` | 수정자. |
| 생성일시 | `CREATED_AT` | 레코드 생성 시각. |
| 수정일시 | `UPDATED_AT` | 레코드 수정 시각. |

---

## 거래유형(`TRANS_TYPE`) 상세

| 유형 | 설명 | QTY 부호 | 재고 효과 |
|------|------|---------|----------|
| RECEIVE | 자재입고(구매·반품) | + | 입고창고 재고 증가 |
| MAT_OUT | 자재출고(생산·수리) | - | 출고창고 재고 감소 |
| MAT_OUT_CANCEL | 출고취소 | + | 출고창고 재고 복원 |
| ADJUST_IN | 보정증가 | + | 해당 창고 재고 증가 |
| ADJUST_OUT | 보정감소 | - | 해당 창고 재고 감소 |
| TRANSFER | 창고간 이동 | N/A | 출고창고 -, 입고창고 + |
| LOT_SPLIT_IN | LOT분할(입력) | + | 분할된 새 LOT 재고 증가 |
| LOT_SPLIT_OUT | LOT분할(출력) | - | 원본 LOT 재고 감소 |
| SCRAP | 폐기 | - | 재고 감소(폐기) |
| MISC_IN | 기타입고 | + | 입고창고 재고 증가 |
| PROD_CONSUME | 생산소비 | - | 출고창고 재고 감소 |
| PROD_CONSUME_CANCEL | 생산소비취소 | + | 출고창고 재고 복원 |

---

## 취소 체인 구조

취소 거래는 **새로운 트랜잭션**으로 생성되며, `CANCEL_REF_ID`에 원본 `TRANS_NO`가 기록됩니다:

```
원본 트랜잭션 (TRANS_NO = 'RCP-20250101-001', QTY = +100, STATUS = 'DONE')
    ↓ 취소 시
취소 트랜잭션 (TRANS_NO = 'CCL-20250101-001', QTY = -100, STATUS = 'DONE',
                CANCEL_REF_ID = 'RCP-20250101-001')
    ↓ 그리고
원본 업데이트 (STATUS = 'CANCELED')
```

화면에서 취소 건을 보면 `원본거래` 컬럼에 원본 `TRANS_NO`가 표시되어 추적할 수 있습니다.

---

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| 특정 트랜잭션이 안 보임 | 일자 범위 또는 거래유형 필터 적용됨 | 필터 조건 해제 후 재조회 |
| 수량이 0으로 표시됨 | 취소 후 원본 상태가 CANCELED로 변경됨 | `CANCEL_REF_ID`로 취소 체인 확인 |
| 창고명이 표시 안 됨 | `FROM_WAREHOUSE_ID` 또는 `TO_WAREHOUSE_ID`가 NULL | 단순 입고/출고는 출고/입고창고 중 하나만 있음 |
| RECEIVE인데 수량이 음수 | 취소 트랜잭션이 RECEIVE 유형으로 생성됨 | `CANCEL_REF_ID`로 원본 확인 |

## 데이터·연계
- **테이블**: `STOCK_TRANSACTIONS` (수불이력), `MAT_STOCKS` (재고), `MAT_LOTS` (LOT)
- **연계**: `ITEM_MASTERS`, `WAREHOUSES`, 발주/작업지시 등 원본 문서
- **스코프**: `COMPANY='40'`, `PLANT_CD='1000'`
