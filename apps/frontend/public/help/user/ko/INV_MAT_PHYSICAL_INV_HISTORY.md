---
menuCode: INV_MAT_PHYSICAL_INV_HISTORY
audience: user
title: 자재재고실사 이력
summary: 자재 재고실사 반영 후 생성된 보정 이력을 조회하고 시스템수량·실사수량·차이와 사유를 확인하는 화면입니다.
tags: [재고, 실사, 이력, 보정]
keywords: [PHYSICAL_COUNT, INV_ADJ_LOGS, beforeQty, afterQty, diffQty]
related: [INV_MAT_PHYSICAL_INV, INV_MAT_PHYSICAL_INV_APPLY, INV_TRANSACTION]
---
# 자재재고실사 이력

## 화면 목적
자재 재고실사 반영 후 생성된 보정 이력을 조회하고 시스템수량·실사수량·차이와 사유를 확인하는 화면입니다.

## 화면 구성
- 조회 API는 /material/physical-inv/history입니다.
- 창고 필터와 검색어로 실사 반영 이력을 조회합니다.

## ① 컬럼·필드

| 컬럼 | 역할 / 의미 |
|------|------|
| **반영일(createdAt)** | 실사 결과가 재고에 반영된 시각입니다. |
| **창고(warehouseCode)** | 실사 차이가 발생한 창고입니다. |
| **품목코드(itemCode)** | 실사 대상 품목입니다. |
| **품목명(itemName)** | 품목 표시명입니다. |
| **LOT No.(matUid)** | 실사 대상 자재 시리얼입니다. |
| **시스템수량(beforeQty)** | 반영 전 장부 재고입니다. |
| **실사수량(afterQty)** | 현장 실사 후 확정 수량입니다. |
| **차이(diffQty)** | 실사수량 - 시스템수량입니다. |
| **사유(reason)** | 실사 반영 사유입니다. |
| **실사자(createdBy)** | 반영 작업자입니다. |

## 사용 순서
1. 기간·창고·검색어를 지정합니다.
2. 차이수량이 양수/음수/0인지 확인합니다.
3. 사유와 작업자를 확인해 재고 보정 근거를 검토합니다.

## 입력 규칙·검증
- 조회 전용 화면이며 반영은 자재재고실사 반영 화면에서 수행합니다.
- 차이 0인 건은 수불 원장이 생성되지 않을 수 있습니다.

## 자주 묻는 질문
- **Q.** 이 화면의 데이터가 다른 자재 화면과 다르게 보입니다.
  **A.** 입하재고, 창고재고, 수불원장은 서로 다른 단계입니다. 같은 자재UID(matUid)로 관련 화면을 함께 확인하세요.
- **Q.** 검색해도 데이터가 안 보입니다.
  **A.** 기간, 상태, 품목, 창고 필터를 초기화한 뒤 원본 업무 단계에서 데이터가 생성되었는지 확인하세요.

## 관련 화면
- INV_MAT_PHYSICAL_INV
- INV_MAT_PHYSICAL_INV_APPLY
- INV_TRANSACTION
