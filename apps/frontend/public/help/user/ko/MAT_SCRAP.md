---
menuCode: MAT_SCRAP
audience: user
title: 자재폐기
summary: 창고에 있는 자재 LOT을 폐기 처리하고 폐기 수불 이력을 조회하는 화면입니다.
tags: [자재, 폐기, 재고, 수불]
keywords: [SCRAP, MAT_SCRAPS, STOCK_TRANSACTIONS, SCRAP_REASON, 폐기]
related: [INV_MAT_STOCK, INV_TRANSACTION, MAT_LOT]
---
# 자재폐기

## 화면 목적
창고에 있는 자재 LOT을 폐기 처리하고 폐기 수불 이력을 조회하는 화면입니다.

## 화면 구성
- 이력 조회 화면은 /inventory/transactions에서 SCRAP 유형을 조회합니다.
- 등록 모달은 창고별 /inventory/stocks 재고를 선택하고 /inventory/scrap으로 폐기 요청합니다.

## ① 컬럼·필드

| 컬럼 | 역할 / 의미 |
|------|------|
| **폐기일시(transDate)** | 폐기 수불이 발생한 시각입니다. |
| **거래번호(transNo)** | 폐기 수불 원장 번호입니다. |
| **품목코드(itemCode)** | 폐기 품목입니다. |
| **품목명(itemName)** | 폐기 품목 표시명입니다. |
| **LOT No.(matUid)** | 폐기 대상 자재 시리얼입니다. |
| **수량(qty)** | 폐기 처리 수량입니다. |
| **창고(warehouseName/warehouseId)** | 폐기 수량이 차감되는 창고입니다. |
| **사유(reason/remark)** | SCRAP_REASON 공통코드 또는 폐기 사유입니다. |
| **재고선택(stockSelect)** | 선택 창고의 품목·LOT·가용수량 중 폐기 대상을 고릅니다. |
| **작업자(workerId)** | 폐기 처리 사용자입니다. |

## 사용 순서
1. 폐기등록을 엽니다.
2. 창고를 선택하고 폐기할 재고 LOT을 고릅니다.
3. 가용수량 이하의 폐기수량과 사유를 입력합니다.
4. 저장 후 SCRAP 수불 이력을 확인합니다.

## 입력 규칙·검증
- 폐기수량은 1 이상이며 재고수량과 가용수량을 초과할 수 없습니다.
- FLOOR 창고 자재는 시스템 설정에 따라 반납 후 폐기해야 합니다.
- 폐기 후 재고가 0이면 LOT 상태가 DEPLETED로 변경됩니다.

## 자주 묻는 질문
- **Q.** 이 화면의 데이터가 다른 자재 화면과 다르게 보입니다.
  **A.** 입하재고, 창고재고, 수불원장은 서로 다른 단계입니다. 같은 자재UID(matUid)로 관련 화면을 함께 확인하세요.
- **Q.** 검색해도 데이터가 안 보입니다.
  **A.** 기간, 상태, 품목, 창고 필터를 초기화한 뒤 원본 업무 단계에서 데이터가 생성되었는지 확인하세요.

## 관련 화면
- INV_MAT_STOCK
- INV_TRANSACTION
- MAT_LOT
