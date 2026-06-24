---
menuCode: MAT_SHELF_LIFE
audience: user
title: 유수명자재 만료현황
summary: 유효기한이 있는 자재 LOT의 만료일과 잔여일수를 확인하고, 만료 임박·만료 LOT을 재검사로 연결하는 화면입니다.
tags: [자재, 유수명, 만료, LOT]
keywords: [expireDate, daysUntilExpiry, NEAR_EXPIRY, EXPIRED, DISCARDED]
related: [MAT_SHELF_LIFE_REINSPECT, MAT_SHELF_LIFE_HISTORY, MAT_LOT]
---
# 유수명자재 만료현황

## 화면 목적
유효기한이 있는 자재 LOT의 만료일과 잔여일수를 확인하고, 만료 임박·만료 LOT을 재검사로 연결하는 화면입니다.

## 화면 구성
- 조회 API는 /material/shelf-life입니다.
- PartSelect와 만료상태 필터로 대상 LOT을 좁혀 봅니다.

## ① 컬럼·필드

| 컬럼 | 역할 / 의미 |
|------|------|
| **LOT No.(matUid)** | 유수명 관리 대상 자재 시리얼입니다. |
| **품목코드(itemCode)** | 자재 품목코드입니다. |
| **품목명(itemName)** | 품목 표시명입니다. |
| **현재수량(currentQty)** | LOT 잔량입니다. |
| **공급사(vendor)** | LOT 납품 거래처입니다. |
| **만료일(expireDate)** | 자재 유효기한입니다. |
| **잔여일수(daysUntilExpiry)** | 오늘 기준 만료일까지 남은 일수입니다. |
| **상태(expiryStatus)** | VALID/NEAR_EXPIRY/EXPIRED/DISCARDED 만료 상태입니다. |
| **작업(actions)** | 임박/만료 LOT을 재검사 화면으로 보냅니다. |

## 사용 순서
1. 품목 또는 검색어로 대상 LOT을 찾습니다.
2. 만료상태 필터로 임박/만료 대상을 확인합니다.
3. 재검사가 필요한 LOT은 재검사 버튼으로 이동합니다.

## 입력 규칙·검증
- DISCARDED는 이미 폐기된 LOT입니다.
- 만료상태는 expireDate와 현재일 기준으로 계산됩니다.

## 자주 묻는 질문
- **Q.** 이 화면의 데이터가 다른 자재 화면과 다르게 보입니다.
  **A.** 입하재고, 창고재고, 수불원장은 서로 다른 단계입니다. 같은 자재UID(matUid)로 관련 화면을 함께 확인하세요.
- **Q.** 검색해도 데이터가 안 보입니다.
  **A.** 기간, 상태, 품목, 창고 필터를 초기화한 뒤 원본 업무 단계에서 데이터가 생성되었는지 확인하세요.

## 관련 화면
- MAT_SHELF_LIFE_REINSPECT
- MAT_SHELF_LIFE_HISTORY
- MAT_LOT
