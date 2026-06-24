---
menuCode: MAT_ARRIVAL_TRANSACTION
audience: user
title: 입하수불조회
summary: 입하 단계에서 발생한 입하 증가와 입하 취소 역분개 원장을 조회하는 화면입니다.
tags: [자재, 입하, 수불, 원장]
keywords: [MAT_ARRIVAL_TRANSACTIONS, ARRIVAL_IN, ARRIVAL_CANCEL, 입하원장, 취소참조]
related: [MAT_ARRIVAL, MAT_ARRIVAL_RESULT, INV_ARRIVAL_STOCK]
---
# 입하수불조회

## 화면 목적
입하 단계에서 발생한 입하 증가와 입하 취소 역분개 원장을 조회하는 화면입니다.

## 화면 구성
- 조회 API는 /material/arrivals이며 화면 DataGrid SQL은 MAT_ARRIVAL_TRANSACTIONS 기준입니다.
- 거래유형, 상태, 검색어, 기간으로 입하 원장을 좁혀 봅니다.

## ① 컬럼·필드

| 컬럼 | 역할 / 의미 |
|------|------|
| **거래일시(transDate)** | 입하 또는 취소 원장이 발생한 시각입니다. |
| **거래번호(transNo)** | 입하 원장 행의 고유 번호입니다. |
| **거래유형(transType)** | ARRIVAL_IN은 입하 증가, ARRIVAL_CANCEL은 취소 역분개입니다. |
| **입하번호(arrivalNo)** | 연결된 입하 실적 번호입니다. |
| **공급사(vendorName)** | 입하 거래처입니다. |
| **품목코드(itemCode)** | 원장 대상 품목입니다. |
| **품목명(itemName)** | 품목 표시명입니다. |
| **MAT UID(matUid)** | LOT 시리얼 단위 추적 키입니다. |
| **수량(qty)** | 원장 수량입니다. 취소 계열은 원본과 반대 방향으로 해석합니다. |
| **입하창고(warehouseName)** | 입하재고가 적치된 창고입니다. |
| **참조(refType/refId)** | 원장이 생성된 업무 출처와 참조번호입니다. |
| **작업자(workerId)** | 처리 사용자입니다. |
| **상태(status)** | DONE/CANCELED 등 원장 상태입니다. |
| **비고(remark)** | 취소 사유나 처리 메모입니다. |

## 사용 순서
1. 기간과 거래유형을 선택합니다.
2. 입하번호, 품목, MAT UID로 원장을 검색합니다.
3. ARRIVAL_IN과 ARRIVAL_CANCEL의 참조 관계를 확인합니다.

## 입력 규칙·검증
- 조회 전용 화면입니다.
- 창고재고 수불은 INV_TRANSACTION에서 확인하고, 이 화면은 입하재고 단계만 봅니다.

## 자주 묻는 질문
- **Q.** 이 화면의 데이터가 다른 자재 화면과 다르게 보입니다.
  **A.** 입하재고, 창고재고, 수불원장은 서로 다른 단계입니다. 같은 자재UID(matUid)로 관련 화면을 함께 확인하세요.
- **Q.** 검색해도 데이터가 안 보입니다.
  **A.** 기간, 상태, 품목, 창고 필터를 초기화한 뒤 원본 업무 단계에서 데이터가 생성되었는지 확인하세요.

## 관련 화면
- MAT_ARRIVAL
- MAT_ARRIVAL_RESULT
- INV_ARRIVAL_STOCK
