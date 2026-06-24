---
menuCode: MAT_SHELF_LIFE
audience: operator
title: 유수명자재 만료현황 — 운영 가이드
summary: 유효기한이 있는 자재 LOT의 만료일과 잔여일수를 확인하고, 만료 임박·만료 LOT을 재검사로 연결하는 화면입니다.
tags: [자재, 유수명, 만료, LOT]
keywords: [expireDate, daysUntilExpiry, NEAR_EXPIRY, EXPIRED, DISCARDED]
related: [MAT_SHELF_LIFE_REINSPECT, MAT_SHELF_LIFE_HISTORY, MAT_LOT]
---

# 유수명자재 만료현황 — 운영 가이드

## 시스템 목적·역할
유효기한이 있는 자재 LOT의 만료일과 잔여일수를 확인하고, 만료 임박·만료 LOT을 재검사로 연결하는 화면입니다.

## 데이터 구조

```text
MAT_LOTS
IQC_LOGS
```

## ① 데이터 테이블 — 전체 컬럼

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| **MAT_UID(MAT_UID)** | `MAT_LOTS.MAT_UID` | 자재 LOT/시리얼의 고유 식별자입니다. |
| **ITEM_CODE(ITEM_CODE)** | `MAT_LOTS.ITEM_CODE` | 품목마스터 기준 품목코드입니다. |
| **CURRENT_QTY(CURRENT_QTY)** | `MAT_LOTS.CURRENT_QTY` | 현재 LOT 잔량입니다. |
| **VENDOR(VENDOR)** | `MAT_LOTS.VENDOR` | 공급사 코드입니다. |
| **EXPIRE_DATE(EXPIRE_DATE)** | `MAT_LOTS.EXPIRE_DATE` | 유수명 자재의 만료일입니다. |
| **STATUS(STATUS)** | `MAT_LOTS.STATUS` | 업무 행의 현재 상태입니다. |
| **COMPANY(COMPANY)** | `MAT_LOTS.COMPANY` | 회사 스코프입니다. 다른 회사 데이터와 섞이지 않게 하는 필수 조건입니다. |
| **PLANT_CD(PLANT_CD)** | `MAT_LOTS.PLANT_CD` | 사업장 스코프입니다. 공장별 자재 흐름을 분리합니다. |
| **CREATED_AT(CREATED_AT)** | `MAT_LOTS.CREATED_AT` | 레코드 생성 시각입니다. |
| **UPDATED_AT(UPDATED_AT)** | `MAT_LOTS.UPDATED_AT` | 마지막 수정 시각입니다. |
| **INSPECT_DATE(INSPECT_DATE)** | `IQC_LOGS.INSPECT_DATE` | 해당 업무 단계의 식별, 상태, 수량 또는 추적 정보를 보관합니다. 운영 시 원본 업무와 수불 원장 대조에 사용합니다. |
| **SEQ(SEQ)** | `IQC_LOGS.SEQ` | 업무 번호 내 상세 순번입니다. |
| **INSPECT_TYPE(INSPECT_TYPE)** | `IQC_LOGS.INSPECT_TYPE` | 해당 업무 단계의 식별, 상태, 수량 또는 추적 정보를 보관합니다. 운영 시 원본 업무와 수불 원장 대조에 사용합니다. |
| **MAT_UID(MAT_UID)** | `IQC_LOGS.MAT_UID` | 자재 LOT/시리얼의 고유 식별자입니다. |
| **ITEM_CODE(ITEM_CODE)** | `IQC_LOGS.ITEM_CODE` | 품목마스터 기준 품목코드입니다. |
| **RETEST_ROUND(RETEST_ROUND)** | `IQC_LOGS.RETEST_ROUND` | 해당 업무 단계의 식별, 상태, 수량 또는 추적 정보를 보관합니다. 운영 시 원본 업무와 수불 원장 대조에 사용합니다. |
| **RESULT(RESULT)** | `IQC_LOGS.RESULT` | 해당 업무 단계의 식별, 상태, 수량 또는 추적 정보를 보관합니다. 운영 시 원본 업무와 수불 원장 대조에 사용합니다. |
| **INSPECTOR_NAME(INSPECTOR_NAME)** | `IQC_LOGS.INSPECTOR_NAME` | 해당 업무 단계의 식별, 상태, 수량 또는 추적 정보를 보관합니다. 운영 시 원본 업무와 수불 원장 대조에 사용합니다. |
| **DESTRUCT_SAMPLE_QTY(DESTRUCT_SAMPLE_QTY)** | `IQC_LOGS.DESTRUCT_SAMPLE_QTY` | 해당 업무 단계의 식별, 상태, 수량 또는 추적 정보를 보관합니다. 운영 시 원본 업무와 수불 원장 대조에 사용합니다. |
| **DETAILS(DETAILS)** | `IQC_LOGS.DETAILS` | 해당 업무 단계의 식별, 상태, 수량 또는 추적 정보를 보관합니다. 운영 시 원본 업무와 수불 원장 대조에 사용합니다. |
| **REMARK(REMARK)** | `IQC_LOGS.REMARK` | 업무 메모 또는 취소/처리 사유입니다. |
| **COMPANY(COMPANY)** | `IQC_LOGS.COMPANY` | 회사 스코프입니다. 다른 회사 데이터와 섞이지 않게 하는 필수 조건입니다. |
| **PLANT_CD(PLANT_CD)** | `IQC_LOGS.PLANT_CD` | 사업장 스코프입니다. 공장별 자재 흐름을 분리합니다. |

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
| 주요 테이블 | `MAT_LOTS`, `IQC_LOGS` |
| 연계 화면 | [MAT_SHELF_LIFE_REINSPECT, MAT_SHELF_LIFE_HISTORY, MAT_LOT] |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` 조건을 모든 업무 조회·저장에 적용 |
