---
menuCode: INV_MAT_PHYSICAL_INV_HISTORY
audience: operator
title: 자재재고실사 이력 — 운영 가이드
summary: 자재 재고실사 반영 후 생성된 보정 이력을 조회하고 시스템수량·실사수량·차이와 사유를 확인하는 화면입니다.
tags: [재고, 실사, 이력, 보정]
keywords: [PHYSICAL_COUNT, INV_ADJ_LOGS, beforeQty, afterQty, diffQty]
related: [INV_MAT_PHYSICAL_INV, INV_MAT_PHYSICAL_INV_APPLY, INV_TRANSACTION]
---

# 자재재고실사 이력 — 운영 가이드

## 시스템 목적·역할
자재 재고실사 반영 후 생성된 보정 이력을 조회하고 시스템수량·실사수량·차이와 사유를 확인하는 화면입니다.

## 데이터 구조

```text
INV_ADJ_LOGS
STOCK_TRANSACTIONS
```

## ① 데이터 테이블 — 전체 컬럼

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| **ADJ_DATE(ADJ_DATE)** | `INV_ADJ_LOGS.ADJ_DATE` | 해당 업무 단계의 식별, 상태, 수량 또는 추적 정보를 보관합니다. 운영 시 원본 업무와 수불 원장 대조에 사용합니다. |
| **SEQ(SEQ)** | `INV_ADJ_LOGS.SEQ` | 업무 번호 내 상세 순번입니다. |
| **WAREHOUSE_CODE(WAREHOUSE_CODE)** | `INV_ADJ_LOGS.WAREHOUSE_CODE` | 창고 기준정보 코드입니다. |
| **ITEM_CODE(ITEM_CODE)** | `INV_ADJ_LOGS.ITEM_CODE` | 품목마스터 기준 품목코드입니다. |
| **MAT_UID(MAT_UID)** | `INV_ADJ_LOGS.MAT_UID` | 자재 LOT/시리얼의 고유 식별자입니다. |
| **ADJ_TYPE(ADJ_TYPE)** | `INV_ADJ_LOGS.ADJ_TYPE` | 재고조정 유형입니다. |
| **BEFORE_QTY(BEFORE_QTY)** | `INV_ADJ_LOGS.BEFORE_QTY` | 반영 전 시스템 수량입니다. |
| **AFTER_QTY(AFTER_QTY)** | `INV_ADJ_LOGS.AFTER_QTY` | 반영 후 실사 수량입니다. |
| **DIFF_QTY(DIFF_QTY)** | `INV_ADJ_LOGS.DIFF_QTY` | 실사수량과 시스템수량의 차이입니다. |
| **REASON(REASON)** | `INV_ADJ_LOGS.REASON` | 조정 또는 폐기 사유입니다. |
| **CREATED_BY(CREATED_BY)** | `INV_ADJ_LOGS.CREATED_BY` | 생성 사용자입니다. |
| **CREATED_AT(CREATED_AT)** | `INV_ADJ_LOGS.CREATED_AT` | 레코드 생성 시각입니다. |
| **COMPANY(COMPANY)** | `INV_ADJ_LOGS.COMPANY` | 회사 스코프입니다. 다른 회사 데이터와 섞이지 않게 하는 필수 조건입니다. |
| **PLANT_CD(PLANT_CD)** | `INV_ADJ_LOGS.PLANT_CD` | 사업장 스코프입니다. 공장별 자재 흐름을 분리합니다. |
| **TRANS_NO(TRANS_NO)** | `STOCK_TRANSACTIONS.TRANS_NO` | 수불 원장 고유 번호입니다. |
| **TRANS_TYPE(TRANS_TYPE)** | `STOCK_TRANSACTIONS.TRANS_TYPE` | 입하·입고·출고·취소 등 수불 유형입니다. |
| **TRANS_DATE(TRANS_DATE)** | `STOCK_TRANSACTIONS.TRANS_DATE` | 수불 발생 시각입니다. |
| **ITEM_CODE(ITEM_CODE)** | `STOCK_TRANSACTIONS.ITEM_CODE` | 품목마스터 기준 품목코드입니다. |
| **MAT_UID(MAT_UID)** | `STOCK_TRANSACTIONS.MAT_UID` | 자재 LOT/시리얼의 고유 식별자입니다. |
| **QTY(QTY)** | `STOCK_TRANSACTIONS.QTY` | 업무 처리 수량입니다. |
| **REF_TYPE(REF_TYPE)** | `STOCK_TRANSACTIONS.REF_TYPE` | 원장이 참조하는 업무 유형입니다. |
| **REF_ID(REF_ID)** | `STOCK_TRANSACTIONS.REF_ID` | 원장이 참조하는 업무 식별값입니다. |
| **STATUS(STATUS)** | `STOCK_TRANSACTIONS.STATUS` | 업무 행의 현재 상태입니다. |
| **COMPANY(COMPANY)** | `STOCK_TRANSACTIONS.COMPANY` | 회사 스코프입니다. 다른 회사 데이터와 섞이지 않게 하는 필수 조건입니다. |
| **PLANT_CD(PLANT_CD)** | `STOCK_TRANSACTIONS.PLANT_CD` | 사업장 스코프입니다. 공장별 자재 흐름을 분리합니다. |

## 사전 설정
- 회사/사업장 스코프는 `COMPANY`, `PLANT_CD`로 제한합니다.
- 품목, 창고, 거래처, 공통코드 값은 기준정보와 공통코드에 먼저 등록되어 있어야 합니다.
- 화면 필터와 상태 배지는 서버 API가 내려주는 현재 상태값을 그대로 표시합니다.

## 운영 절차
1. 기간, 상태, 품목, 창고 조건을 지정해 대상 데이터를 조회합니다.
2. 화면의 식별번호와 `MAT_UID`를 기준으로 원본 업무와 원장을 대조합니다.
3. 수량 차이가 있으면 입하재고, 창고재고, 수불원장 중 어느 단계인지 먼저 분리합니다.

## 권한
- 조회는 자재/재고 업무 권한 사용자가 수행합니다.
- 저장, 취소, 출력 같은 변경성 작업은 메뉴 권한과 서버 API 권한을 모두 통과해야 합니다.

## 문제 해결
| 증상 | 확인 지점 | 조치 |
|------|------|------|
| 데이터가 보이지 않음 | 기간, 상태, 품목, 창고 필터와 COMPANY/PLANT_CD 스코프 | 필터 초기화 후 원본 업무 화면에서 생성 여부 확인 |
| 수량이 예상과 다름 | 입하재고, 창고재고, 수불원장 중 어느 단계인지 확인 | 같은 matUid로 관련 화면을 단계별 조회 |
| 저장 또는 취소 실패 | 상태값, 가용수량, IQC 상태, 필수 사유 | 오류 메시지의 업무 조건을 먼저 해소 |

## 데이터·연계
| 구분 | 내용 |
|------|------|
| 주요 테이블 | `INV_ADJ_LOGS`, `STOCK_TRANSACTIONS` |
| 연계 화면 | [INV_MAT_PHYSICAL_INV, INV_MAT_PHYSICAL_INV_APPLY, INV_TRANSACTION] |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` 조건을 모든 업무 조회·저장에 적용 |
