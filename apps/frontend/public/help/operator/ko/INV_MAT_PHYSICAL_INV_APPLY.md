---
menuCode: INV_MAT_PHYSICAL_INV_APPLY
audience: operator
title: 자재재고실사 반영 — 운영 가이드
summary: 실사 반영 프로세스, 재고 업데이트 구조, 트랜잭션 처리와 트러블슈팅
tags: [재고, 실사, 반영, 운영, 수량]
keywords: [PHYSICAL_INV_COUNT_DETAILS, MAT_STOCKS, 실사반영, applyCount, STOCK_TRANSACTIONS, INV_ADJ_LOGS, PHYSCOUNT_IN, PHYSCOUNT_OUT]
related: [INV_MAT_PHYSICAL_INV, INV_MAT_STOCK, MAT_ADJUSTMENT]
---

# 자재재고실사 반영 — 운영 가이드

## 시스템 목적·역할
재고실사 세션 완료 후 PDA 스캔 수량(또는 PC에서 직접 입력한 수량)을 기준으로 시스템 재고를 실제와 일치시키는 최종 반영 단계입니다. `applyCount()`가 실행되면 `MAT_STOCKS`의 수량이 업데이트되고, `STOCK_TRANSACTIONS`에 `PHYSCOUNT_IN/OUT`이 기록되며, `INV_ADJ_LOGS`에 `PHYSICAL_COUNT` 유형의 감사 이력이 생성됩니다.

## 데이터 구조
```
PHYSICAL_INV_SESSIONS (COMPLETED)
    │
    └── PHYSICAL_INV_COUNT_DETAILS (systemQty, countedQty, diffQty)
            │
            ▼ 반영(apply) 시
    MAT_STOCKS.qty = countedQty로 업데이트
    MAT_STOCKS.lastCountAt = now
    MAT_STOCKS.availableQty 재계산
            │
            ├── STOCK_TRANSACTIONS (PHYSCOUNT_IN / PHYSCOUNT_OUT)
            │
            └── INV_ADJ_LOGS (adjType = 'PHYSICAL_COUNT')
```

---

## ① 실사 반영 컬럼

| 화면 항목 | DB(소스) | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 창고 | `PHYSICAL_INV_COUNT_DETAILS.WAREHOUSE_CODE` | 실사 대상 창고. |
| 품목코드 | `PHYSICAL_INV_COUNT_DETAILS.ITEM_CODE` | 실사 품목. |
| 자재시리얼 | `PHYSICAL_INV_COUNT_DETAILS.MAT_UID` | LOT 시리얼. |
| 시스템수량 | `PHYSICAL_INV_COUNT_DETAILS.SYSTEM_QTY` | 세션 개시 시점 스냅샷(변경 불가). |
| 실사수량 | `PHYSICAL_INV_COUNT_DETAILS.COUNTED_QTY` | PDA 누적값 또는 PC 직접 입력. **반영 전 수정 가능**. |
| 차이 | `COUNTED_QTY - SYSTEM_QTY` | 양수 = 실제가 더 많음, 음수 = 실제가 더 적음. |

---

## 반영(Apply) 처리 상세

`POST /material/physical-inv` → `PhysicalInvService.applyCount()`에서 수행:

1. 각 `PhysicalInvItemDto.stockId`(warehouseCode::itemCode::matUid)로 `MatStock` 조회
2. `MatStock.qty`를 `countedQty`로 설정
3. `MatStock.availableQty` 재계산(`qty - reservedQty`)
4. `MatStock.lastCountAt` 갱신
5. `StockTransaction` 생성:
   - `PHYSCOUNT_IN`: 차이가 양수면 증가분 기록
   - `PHYSCOUNT_OUT`: 차이가 음수면 감소분 기록
6. `InvAdjLog` 기록: `adjType = 'PHYSICAL_COUNT'`, `diffQty` 저장

---

## 반영 전 확인 사항
- **PDA 스캔이 완료**되었는지(미스캔 여부) 확인합니다.
- **실사수량이 0**인 항목은 실제 재고가 없는 것으로 간주하되, PDA 미스캔 가능성을 고려합니다.
- **차이가 큰 항목**은 재확인이 필요할 수 있습니다(도난·분실·입출고 오류).
- 반영 후에는 `MAT_STOCKS`가 직접 변경되므로 신중히 실행합니다.

## 권한
재고실사 반영 권한이 있는 사용자(자재/품질 관리자).

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| 실사반영 버튼 비활성화 | 선택한 조건에 불일치 항목이 없음(모두 일치) | 실사 결과가 정확하면 반영 불필요 |
| "MatStock not found" 오류 | `stockId`에 해당하는 재고 레코드 없음 | 해당 품목의 입고 이력 확인 |
| 실사수량 수정이 안 됨 | 입력 필드가 readonly 또는 값이 문자열로 처리됨 | 숫자만 입력(0 이상 정수) |
| 반영 후 수량이 PDA와 다름 | 반영 전에 시스템 수량이 이미 변경됨 | 입출고 이력 확인 후 재실사 필요 |
| 반영 후에도 차이가 남 | 다른 세션 또는 보정에서 수량이 변경됨 | 재고 현황 재조회 및 원인 분석 |

## 데이터·연계
- **테이블**: `PHYSICAL_INV_COUNT_DETAILS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS`, `INV_ADJ_LOGS`
- **연계**: 재고실사 관리(세션), 자재재고현황 조회
- **스코프**: `COMPANY='40'`, `PLANT_CD='1000'`
