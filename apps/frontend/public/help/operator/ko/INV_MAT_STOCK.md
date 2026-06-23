---
menuCode: INV_MAT_STOCK
audience: operator
title: 자재재고현황조회 — 운영 가이드
summary: MAT_STOCKS 테이블 전체 컬럼, 재고 상태 판정 로직, LOT 연계 구조와 트러블슈팅
tags: [재고, 자재, 운영, 조회, 안전재고]
keywords: [MAT_STOCKS, MAT_LOTS, 재고조회, 안전재고, 가용재고, QTY, RESERVED_QTY, AVAILABLE_QTY, 시리얼별, SAFETY_STOCK, 유효기간, ITEM_MASTERS]
related: [INV_TRANSACTION, INV_MAT_PHYSICAL_INV]
---

# 자재재고현황조회 — 운영 가이드

## 시스템 목적·역할
`MAT_STOCKS` 테이블을 기반으로 창고별·품목별 자재 재고 현황을 실시간 조회합니다. 품목마스터(`ITEM_MASTERS`)의 안전재고(`SAFETY_STOCK`)와 대비한 재고 부족 여부, LOT 유효기간(`MAT_LOTS.EXPIRE_DATE`) 대비 만료 상태를 함께 표시하여 재고 운영 의사결정을 지원합니다.

## 데이터 구조
```
MAT_STOCKS (PK: COMPANY + PLANT_CD + WAREHOUSE_CODE + ITEM_CODE + MAT_UID)
    │
    ├── QTY (총재고) = RESERVED_QTY (예약) + AVAILABLE_QTY (가용)
    │
    ├──▶ ITEM_MASTERS.ITEM_CODE — 품목명(itemName), 단위(unit), 안전재고(safetyStock)
    │
    ├──▶ MAT_LOTS.MAT_UID — 제조일자(manufactureDate), 유통기한(expireDate)
    │
    └──▶ WAREHOUSES.WAREHOUSE_CODE — 창고명(warehouseName)
```

---

## ① 재고 — MAT_STOCKS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 회사 | `COMPANY` | **PK (1/5)**. 멀티테넌시. `'40'`. |
| 사업장 | `PLANT_CD` | **PK (2/5)**. 멀티테넌시. `'1000'`. |
| 창고코드 | `WAREHOUSE_CODE` | **PK (3/5)**. 재고 보관 창고. |
| 품목코드 | `ITEM_CODE` | **PK (4/5)**. 재고 품목. `ITEM_MASTERS.ITEM_CODE` 참조. |
| 자재시리얼 | `MAT_UID` | **PK (5/5)**. LOT 단위 식별자. `MAT_LOTS.MAT_UID` 참조. |
| 로케이션 | `LOCATION_CODE` | 창고 내 상세 적치 위치(선택). |
| 총 수량 | `QTY` | 현재 창고에 보관 중인 총 재고 수량. |
| 예약 수량 | `RESERVED_QTY` | 출고요청 등으로 예약된 수량. |
| 가용 수량 | `AVAILABLE_QTY` | 즉시 사용 가능한 수량(= QTY - RESERVED_QTY). |
| 최종 실사일 | `LAST_COUNT` | 마지막으로 실사(Physical Count)한 시각. |
| 생성자 | `CREATED_BY` | 최초 등록자. |
| 수정자 | `UPDATED_BY` | 최종 수정자. |
| 생성일시 | `CREATED_AT` | 최초 등록 시각. |
| 수정일시 | `UPDATED_AT` | 최종 수정 시각. |

> **재고 수량 관계**: `QTY = RESERVED_QTY + AVAILABLE_QTY`. 출고 가능한 실제 수량은 `AVAILABLE_QTY`입니다.

---

## 재고 상태 판정 로직

품목마스터의 `SAFETY_STOCK`(안전재고) 기준과 실제 수량(`QTY`)을 비교하여 3단계 상태를 표시합니다:

| 상태 | 조건 | 표시 |
|------|------|------|
| **부족(Shortage)** | `QTY < SAFETY_STOCK × 0.5` | 빨강 배지 |
| **주의(Caution)** | `QTY < SAFETY_STOCK` | 노랑 배지 |
| **정상(Normal)** | `QTY ≥ SAFETY_STOCK` | 초록 배지 |

## 유효기간 상태 판정 로직

LOT의 `EXPIRE_DATE`와 현재일을 비교하여 3단계 유효기간 상태를 표시합니다:

| 상태 | 조건 | 표시 |
|------|------|------|
| **만료(Expired)** | `remainingDays ≤ 0` | 빨강 배지 + 행 배경 빨강 |
| **임박(Imminent)** | `remainingDays ≤ 10` | 노랑 배지 + 행 배경 노랑 |
| **정상(Normal)** | `remainingDays > 10` | 초록 배지 |

---

## 운영 절차
1. 정기적으로 재고 현황을 조회하여 안전재고 미달 품목과 유효기간 만료 LOT를 확인합니다.
2. 안전재고 미달 품목은 발주 또는 타 창고 이동을 검토합니다.
3. 유효기간 만료 LOT는 폐기 또는 반품 처리하고, 임박 LOT는 우선 사용 계획을 수립합니다.

## 권한
재고 조회 권한이 있는 모든 사용자(기준정보·생산·자재 관리자). 조회 전용입니다(수정 불가).

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| 특정 품목이 목록에 안 보임 | 해당 창고에 재고 없음(`MAT_STOCKS`에 행 없음) | 입고 또는 보정 처리 |
| 수량이 실제와 다름 | 입출고 누락 또는 중복 처리 | 입출고 이력 확인 후 보정 |
| 가용수량이 총수량보다 작음 | 출고요청(LOT 예약)이 있음 | 예약 상태 확인 후 필요 시 예약 취소 |
| 유효기간 만료 LOT가 빨강 표시 | `remainingDays ≤ 0` | 폐기·반품 또는 품질 승인 후 사용 |
| 안전재고 부족 표시가 정확하지 않음 | `SAFETY_STOCK` 값이 설정되지 않았거나 부정확 | 품목마스터에서 안전재고 기준 확인·수정 |

## 데이터·연계
- **테이블**: `MAT_STOCKS` (재고), `MAT_LOTS` (LOT 정보), `ITEM_MASTERS` (품목), `WAREHOUSES` (창고)
- **연계**: 자재입고 → `MAT_STOCKS` 증가, 자재출고 → `MAT_STOCKS` 감소, 재고보정 → `MAT_STOCKS` 증감
- **스코프**: `COMPANY='40'`, `PLANT_CD='1000'`
