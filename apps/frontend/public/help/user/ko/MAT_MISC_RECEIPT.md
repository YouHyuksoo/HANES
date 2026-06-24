---
menuCode: MAT_MISC_RECEIPT
audience: user
title: 기타입고
summary: PO/IQC 입고 흐름이 아닌 예외 입고를 창고재고에 직접 반영하고 MISC_IN 수불을 남기는 화면입니다.
tags: [자재, 기타입고, 재고, 수불]
keywords: [MISC_IN, MAT_MISC_RECEIPTS, RECEIPT_ACCOUNT, 기타입고]
related: [INV_MAT_STOCK, INV_TRANSACTION, MAT_RECEIVE]
---
# 기타입고

## 화면 목적
PO/IQC 입고 흐름이 아닌 예외 입고를 창고재고에 직접 반영하고 MISC_IN 수불을 남기는 화면입니다.

## 화면 구성
- 조회/등록 API는 /material/misc-receipt입니다.
- 품목 검색은 /master/parts를 사용하고, 입고계정은 RECEIPT_ACCOUNT 공통코드입니다.

## ① 컬럼·필드

| 컬럼 | 역할 / 의미 |
|------|------|
| **입고일시(transDate)** | 기타입고가 재고에 반영된 시각입니다. |
| **거래번호(transNo)** | 기타입고 수불 번호입니다. |
| **품목코드(itemCode)** | 입고 대상 품목입니다. |
| **품목명(itemName)** | 품목 표시명입니다. |
| **창고(warehouseName/warehouseId)** | 수량이 증가하는 창고입니다. |
| **수량(qty)** | 증가시킬 재고 수량입니다. |
| **비고(remark)** | 기타입고 사유나 메모입니다. |
| **입고계정(account)** | RECEIPT_ACCOUNT 공통코드 값이며 미지정 시 PROD입니다. |
| **자재UID(matUid)** | LOT 단위 입고가 필요한 경우 지정하는 선택값입니다. |
| **작업자(workerId)** | 처리 사용자입니다. |

## 사용 순서
1. 기타입고 등록을 엽니다.
2. 창고, 입고계정, 품목을 선택합니다.
3. 수량과 비고를 입력하고 저장합니다.
4. 이력에서 MISC_IN 거래번호와 수량을 확인합니다.

## 입력 규칙·검증
- 수량은 1 이상이어야 합니다.
- matUid가 있으면 해당 LOT의 품목코드가 선택 품목과 같아야 합니다.
- 기존 MAT_STOCKS 행이 있으면 수량을 증가시키고 없으면 신규 행을 만듭니다.

## 자주 묻는 질문
- **Q.** 이 화면의 데이터가 다른 자재 화면과 다르게 보입니다.
  **A.** 입하재고, 창고재고, 수불원장은 서로 다른 단계입니다. 같은 자재UID(matUid)로 관련 화면을 함께 확인하세요.
- **Q.** 검색해도 데이터가 안 보입니다.
  **A.** 기간, 상태, 품목, 창고 필터를 초기화한 뒤 원본 업무 단계에서 데이터가 생성되었는지 확인하세요.

## 관련 화면
- INV_MAT_STOCK
- INV_TRANSACTION
- MAT_RECEIVE
