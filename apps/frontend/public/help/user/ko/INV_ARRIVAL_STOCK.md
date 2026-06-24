---
menuCode: INV_ARRIVAL_STOCK
audience: user
title: 입하재고현황
summary: 입하 후 일반 창고재고로 입고되기 전의 입하재고를 조회하는 화면입니다.
tags: [자재, 입하재고, IQC, 대기재고]
keywords: [MAT_ARRIVAL_STOCKS, 입하재고, currentStock, arrivalQty, IQC]
related: [MAT_ARRIVAL, MAT_ARRIVAL_RESULT, MAT_RECEIVE]
---
# 입하재고현황

## 화면 목적
입하 후 일반 창고재고로 입고되기 전의 입하재고를 조회하는 화면입니다.

## 화면 구성
- 조회 API는 /material/arrivals/stock-status입니다.
- MAT_ARRIVAL_STOCKS와 MAT_LOTS, 품목, 창고 정보를 조합해 표시합니다.

## ① 컬럼·필드

| 컬럼 | 역할 / 의미 |
|------|------|
| **입하번호(arrivalNo)** | 입하재고가 발생한 입하 실적 번호입니다. |
| **인보이스(invoiceNo)** | 공급업체 인보이스 번호입니다. |
| **공급사(vendorName)** | 납품 거래처입니다. |
| **품목코드(itemCode)** | 입하재고 품목입니다. |
| **품목명(itemName)** | 품목 표시명입니다. |
| **자재UID(matUid)** | 입하재고 LOT 시리얼입니다. |
| **입하수량(arrivalQty)** | 입하 당시 수량입니다. |
| **현재재고(currentStock)** | 입하재고로 남아 있는 현재 수량입니다. |
| **단위(unit)** | 품목 단위입니다. |
| **창고(warehouseName)** | 입하재고 적치 창고입니다. |
| **입하구분(arrivalType)** | PO/수동 등 입하 출처입니다. |
| **입하일(arrivalDate)** | 입하 등록 날짜입니다. |
| **제조일(manufactureDate)** | 자재 제조일입니다. |
| **유효기한(expireDate)** | 자재 만료일입니다. |

## 사용 순서
1. 품목, 창고, 상태 조건으로 입하재고를 조회합니다.
2. 입하수량과 현재재고를 비교합니다.
3. IQC PASS 후 자재입고관리에서 일반 창고재고로 반영합니다.

## 입력 규칙·검증
- 입하재고는 MAT_STOCKS 일반재고가 아니므로 생산 출고 대상이 아닙니다.
- 입고 처리되면 입하재고는 차감되고 MAT_STOCKS가 증가합니다.

## 자주 묻는 질문
- **Q.** 이 화면의 데이터가 다른 자재 화면과 다르게 보입니다.
  **A.** 입하재고, 창고재고, 수불원장은 서로 다른 단계입니다. 같은 자재UID(matUid)로 관련 화면을 함께 확인하세요.
- **Q.** 검색해도 데이터가 안 보입니다.
  **A.** 기간, 상태, 품목, 창고 필터를 초기화한 뒤 원본 업무 단계에서 데이터가 생성되었는지 확인하세요.

## 관련 화면
- MAT_ARRIVAL
- MAT_ARRIVAL_RESULT
- MAT_RECEIVE
