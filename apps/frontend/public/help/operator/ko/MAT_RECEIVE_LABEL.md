---
menuCode: MAT_RECEIVE_LABEL
audience: operator
title: 자재라벨발행 — 운영 가이드
summary: IQC 합격 입하 건의 자재 라벨을 선택·미리보기·출력하고, 라벨 발행 이력을 확인하는 화면입니다.
tags: [자재, 라벨, 입고, 출력]
keywords: [라벨발행, receive-label, LabelPrintLog, ZPL, BROWSER, mat_lot]
related: [MAT_ARRIVAL_RESULT, MAT_RECEIVE, MST_LABEL]
---

# 자재라벨발행 — 운영 가이드

## 시스템 목적·역할
IQC 합격 입하 건의 자재 라벨을 선택·미리보기·출력하고, 라벨 발행 이력을 확인하는 화면입니다.

## 데이터 구조

```text
MAT_ARRIVALS
MAT_LOTS
LABEL_PRINT_LOGS
```

## ① 데이터 테이블 — 전체 컬럼

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| **ARRIVAL_NO(ARRIVAL_NO)** | `MAT_ARRIVALS.ARRIVAL_NO` | 입하 업무 번호입니다. |
| **SEQ(SEQ)** | `MAT_ARRIVALS.SEQ` | 업무 번호 내 상세 순번입니다. |
| **ITEM_CODE(ITEM_CODE)** | `MAT_ARRIVALS.ITEM_CODE` | 품목마스터 기준 품목코드입니다. |
| **QTY(QTY)** | `MAT_ARRIVALS.QTY` | 업무 처리 수량입니다. |
| **PO_NO(PO_NO)** | `MAT_ARRIVALS.PO_NO` | 해당 업무 단계의 식별, 상태, 수량 또는 추적 정보를 보관합니다. 운영 시 원본 업무와 수불 원장 대조에 사용합니다. |
| **VENDOR_NAME(VENDOR_NAME)** | `MAT_ARRIVALS.VENDOR_NAME` | 해당 업무 단계의 식별, 상태, 수량 또는 추적 정보를 보관합니다. 운영 시 원본 업무와 수불 원장 대조에 사용합니다. |
| **SUP_UID(SUP_UID)** | `MAT_ARRIVALS.SUP_UID` | 해당 업무 단계의 식별, 상태, 수량 또는 추적 정보를 보관합니다. 운영 시 원본 업무와 수불 원장 대조에 사용합니다. |
| **INVOICE_NO(INVOICE_NO)** | `MAT_ARRIVALS.INVOICE_NO` | 해당 업무 단계의 식별, 상태, 수량 또는 추적 정보를 보관합니다. 운영 시 원본 업무와 수불 원장 대조에 사용합니다. |
| **IQC_STATUS(IQC_STATUS)** | `MAT_ARRIVALS.IQC_STATUS` | 수입검사 진행 또는 판정 상태입니다. |
| **ARRIVAL_DATE(ARRIVAL_DATE)** | `MAT_ARRIVALS.ARRIVAL_DATE` | 해당 업무 단계의 식별, 상태, 수량 또는 추적 정보를 보관합니다. 운영 시 원본 업무와 수불 원장 대조에 사용합니다. |
| **COMPANY(COMPANY)** | `MAT_ARRIVALS.COMPANY` | 회사 스코프입니다. 다른 회사 데이터와 섞이지 않게 하는 필수 조건입니다. |
| **PLANT_CD(PLANT_CD)** | `MAT_ARRIVALS.PLANT_CD` | 사업장 스코프입니다. 공장별 자재 흐름을 분리합니다. |
| **MAT_UID(MAT_UID)** | `MAT_LOTS.MAT_UID` | 자재 LOT/시리얼의 고유 식별자입니다. |
| **ITEM_CODE(ITEM_CODE)** | `MAT_LOTS.ITEM_CODE` | 품목마스터 기준 품목코드입니다. |
| **INIT_QTY(INIT_QTY)** | `MAT_LOTS.INIT_QTY` | LOT 발행 당시 초기수량입니다. |
| **CURRENT_QTY(CURRENT_QTY)** | `MAT_LOTS.CURRENT_QTY` | 현재 LOT 잔량입니다. |
| **ARRIVAL_NO(ARRIVAL_NO)** | `MAT_LOTS.ARRIVAL_NO` | 입하 업무 번호입니다. |
| **ARRIVAL_SEQ(ARRIVAL_SEQ)** | `MAT_LOTS.ARRIVAL_SEQ` | 입하번호 내 상세 순번입니다. |
| **IQC_STATUS(IQC_STATUS)** | `MAT_LOTS.IQC_STATUS` | 수입검사 진행 또는 판정 상태입니다. |
| **STATUS(STATUS)** | `MAT_LOTS.STATUS` | 업무 행의 현재 상태입니다. |
| **COMPANY(COMPANY)** | `MAT_LOTS.COMPANY` | 회사 스코프입니다. 다른 회사 데이터와 섞이지 않게 하는 필수 조건입니다. |
| **PLANT_CD(PLANT_CD)** | `MAT_LOTS.PLANT_CD` | 사업장 스코프입니다. 공장별 자재 흐름을 분리합니다. |
| **PRINTED_AT(PRINTED_AT)** | `LABEL_PRINT_LOGS.PRINTED_AT` | 라벨 발행 시각입니다. |
| **SEQ(SEQ)** | `LABEL_PRINT_LOGS.SEQ` | 업무 번호 내 상세 순번입니다. |
| **CATEGORY(CATEGORY)** | `LABEL_PRINT_LOGS.CATEGORY` | 해당 업무 단계의 식별, 상태, 수량 또는 추적 정보를 보관합니다. 운영 시 원본 업무와 수불 원장 대조에 사용합니다. |
| **PRINT_MODE(PRINT_MODE)** | `LABEL_PRINT_LOGS.PRINT_MODE` | 라벨 출력 방식입니다. |
| **UID_LIST(UID_LIST)** | `LABEL_PRINT_LOGS.UID_LIST` | 출력된 UID 목록 JSON입니다. |
| **LABEL_COUNT(LABEL_COUNT)** | `LABEL_PRINT_LOGS.LABEL_COUNT` | 발행 매수입니다. |
| **PRINTER_NAME(PRINTER_NAME)** | `LABEL_PRINT_LOGS.PRINTER_NAME` | 출력 프린터명입니다. |
| **STATUS(STATUS)** | `LABEL_PRINT_LOGS.STATUS` | 업무 행의 현재 상태입니다. |
| **WORKER_NO(WORKER_NO)** | `LABEL_PRINT_LOGS.WORKER_NO` | 작업자 사번/사용자 식별값입니다. |
| **COMPANY(COMPANY)** | `LABEL_PRINT_LOGS.COMPANY` | 회사 스코프입니다. 다른 회사 데이터와 섞이지 않게 하는 필수 조건입니다. |
| **PLANT_CD(PLANT_CD)** | `LABEL_PRINT_LOGS.PLANT_CD` | 사업장 스코프입니다. 공장별 자재 흐름을 분리합니다. |

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
| 주요 테이블 | `MAT_ARRIVALS`, `MAT_LOTS`, `LABEL_PRINT_LOGS` |
| 연계 화면 | [MAT_ARRIVAL_RESULT, MAT_RECEIVE, MST_LABEL] |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` 조건을 모든 업무 조회·저장에 적용 |
