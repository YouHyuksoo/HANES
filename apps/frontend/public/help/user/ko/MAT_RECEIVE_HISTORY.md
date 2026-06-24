---
menuCode: MAT_RECEIVE_HISTORY
audience: user
title: 자재입고이력
summary: IQC 합격 후 창고재고로 반영된 자재입고 이력을 조회하는 화면입니다.
tags: [자재, 입고, 이력, 바코드]
keywords: [MAT_RECEIVINGS, receiveNo, vendorBarcode, 입고이력]
related: [MAT_RECEIVE, INV_TRANSACTION, INV_MAT_STOCK]
---
# 자재입고이력

## 화면 목적
IQC 합격 후 창고재고로 반영된 자재입고 이력을 조회하는 화면입니다.

## 화면 구성
- 조회 API는 /material/receiving입니다.
- 공급사 필터, 품목/LOT/바코드 검색, 기간 필터로 입고 이력을 확인합니다.

## ① 컬럼·필드

| 컬럼 | 역할 / 의미 |
|------|------|
| **입고번호(receiveNo)** | 입고 업무 배치 번호입니다. |
| **SEQ(seq)** | 입고번호 안의 상세 순번입니다. |
| **입고일(receiveDate)** | 자재가 MAT_STOCKS에 반영된 시각입니다. |
| **자재UID(matUid)** | 입고된 LOT 시리얼입니다. |
| **거래처바코드(vendorBarcode)** | 입고 시 스캔한 공급업체 원본 바코드입니다. |
| **품목코드(itemCode)** | 입고 품목입니다. |
| **품목명(itemName)** | 품목 표시명입니다. |
| **수량(qty)** | 입고 처리 수량입니다. |
| **창고(warehouseCode/warehouseName)** | 입고 재고가 반영된 창고입니다. |
| **입하번호(arrivalNo)** | 원본 입하 실적 번호입니다. |
| **입하순번(arrivalSeq)** | 원본 입하 상세 순번입니다. |
| **작업자(workerId)** | 입고 처리 사용자입니다. |
| **상태(status)** | 입고 이력 상태입니다. |
| **비고(remark)** | 입고 메모입니다. |

## 사용 순서
1. 기간과 공급사 조건을 지정합니다.
2. 품목, LOT, 거래처바코드로 검색합니다.
3. 입고번호와 입하번호를 함께 확인해 입하→IQC→입고 흐름을 추적합니다.

## 입력 규칙·검증
- 입하만 되고 아직 입고 처리되지 않은 LOT은 이력에 나타나지 않습니다.
- 거래처바코드는 기준 매핑이 아니라 실제 입고 시 스캔한 원본값입니다.

## 자주 묻는 질문
- **Q.** 이 화면의 데이터가 다른 자재 화면과 다르게 보입니다.
  **A.** 입하재고, 창고재고, 수불원장은 서로 다른 단계입니다. 같은 자재UID(matUid)로 관련 화면을 함께 확인하세요.
- **Q.** 검색해도 데이터가 안 보입니다.
  **A.** 기간, 상태, 품목, 창고 필터를 초기화한 뒤 원본 업무 단계에서 데이터가 생성되었는지 확인하세요.

## 관련 화면
- MAT_RECEIVE
- INV_TRANSACTION
- INV_MAT_STOCK
