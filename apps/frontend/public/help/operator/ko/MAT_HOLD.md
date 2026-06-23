---
menuCode: MAT_HOLD
audience: operator
title: 자재재고홀드관리 — 운영 가이드
summary: MAT_LOTS.status 기반 홀드 메커니즘, 관련 테이블, 재고 영향과 트러블슈팅
tags: [자재, 홀드, 운영, LOT, 품질]
keywords: [MAT_LOTS, STATUS, HOLD, NORMAL, DEPLETED, 재고홀드, 품질홀드, LOT차단, 출고차단, MAT_STOCKS]
related: [INV_MAT_STOCK]
---

# 자재재고홀드관리 — 운영 가이드

## 시스템 목적·역할
`MAT_LOTS.STATUS` 값을 `NORMAL` → `HOLD`(또는 `HOLD` → `NORMAL`)로 변경하여 특정 LOT의 사용을 차단하거나 해제합니다. 홀드된 LOT는 `MAT_STOCKS`에 재고로 존재하지만, 출고·생산투입이 불가능합니다(시스템에서 `status = 'HOLD'`를 체크하여 차단).

## 데이터 구조
```
MAT_LOTS (PK: MAT_UID)
    │
    ├── STATUS (NORMAL / HOLD / DEPLETED / SPLIT / MERGED)
    ├── ITEM_CODE → ITEM_MASTERS (itemName, unit)
    ├── VENDOR → PARTNER_MASTERS (vendorName)
    │
    └──▶ MAT_STOCKS (PK: COMPANY + PLANT_CD + WAREHOUSE_CODE + ITEM_CODE + MAT_UID)
            └── 재고 수량은 유지되나, HOLD 상태 LOT는 가용재고에서 제외
```

---

## ① LOT — MAT_LOTS (홀드 관련 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 자재시리얼 | `MAT_UID` | **PK**. LOT/시리얼 번호. |
| 품목코드 | `ITEM_CODE` | 품목. `ITEM_MASTERS` 참조. |
| 현재잔량 | `CURRENT_QTY` | LOT의 현재 재고 수량. |
| 상태 | `STATUS` | `NORMAL`(정상) / `HOLD`(홀드) / `DEPLETED`(소진) / `SPLIT`(분할됨) / `MERGED`(병합됨). |
| 공급처코드 | `VENDOR` | 공급사 코드. `PARTNER_MASTERS` 참조. |
| IQC상태 | `IQC_STATUS` | `PENDING` / `PASS` / `FAIL` / `HOLD`. |
| 회사 | `COMPANY` | 멀티테넌시. |
| 사업장 | `PLANT_CD` | 멀티테넌시. |
| 제조일자 | `MANUFACTURE_DATE` | 제조일. |
| 유통기한 | `EXPIRE_DATE` | 유효기간 만료일. |

---

## 홀드 메커니즘

| 작업 | 전제조건 | DB 변경 | 재고 효과 |
|------|---------|---------|----------|
| **홀드** | LOT 존재, `STATUS ≠ HOLD`, `STATUS ≠ DEPLETED` | `MAT_LOTS.STATUS = 'HOLD'` | 재고는 유지되나 가용재고에서 제외 |
| **해제** | LOT 존재, `STATUS = 'HOLD'` | `MAT_LOTS.STATUS = 'NORMAL'` | 가용재고에 다시 포함 |

> **주의**: `DEPLETED` 상태의 LOT는 홀드할 수 없으며, 홀드된 LOT는 출고·생산 투입 등 모든 재고 변동이 차단됩니다.

---

## 홀드 대상 사례
| 상황 | 설명 |
|------|------|
| 품질 불량 | IQC FAIL 또는 생산 중 불량 발견 시 해당 LOT 홀드 |
| 유통기한 만료 | 유효기간이 지난 LOT 홀드 후 폐기 처리 |
| 공급처 클레임 | 특정 공급처의 LOT에 문제가 의심될 때 선제 홀드 |
| 시스템 오류 정정 | 입출고 오류로 수량이 비정상적인 LOT 일시 차단 |

## 권한
재고 홀드 권한이 있는 사용자(품질·자재 관리자).

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| 홀드 버튼이 안 보임 | LOT가 이미 HOLD 상태 | 해제 버튼으로 전환됨 |
| "DEPLETED LOT은 홀드할 수 없습니다" 오류 | 이미 소진된 LOT | 소진 LOT는 홀드 불필요 |
| 홀드 해제가 안 됨 | LOT의 STATUS가 HOLD가 아님 | 현재 상태 확인 |
| 홀드했는데 출고가 가능함 | `MAT_LOTS.STATUS` 체크 로직이 없는 출고 프로세스 | 출고 서비스에서 HOLD 체크 로직 확인 |
| 사유가 저장 안 됨 | 현재 서비스에서 `reason` 필드를 DB에 저장하지 않음 | 별도 감사 이력 필요 시 확장 필요 |
| 홀드 LOT의 재고가 여전히 집계됨 | `MAT_STOCKS.qty`는 변경되지 않음(상태만 변경) | 총재고에서 HOLD LOT는 별도 관리 필요 |

## 데이터·연계
- **테이블**: `MAT_LOTS` (LOT 상태), `MAT_STOCKS` (재고)
- **참조**: `ITEM_MASTERS`(품목명), `PARTNER_MASTERS`(공급처명)
- **스코프**: `COMPANY='40'`, `PLANT_CD='1000'`
- **참고**: 제품(`PRODUCT_STOCKS`)에는 별도의 `HOLD_REASON`, `HOLD_AT`, `HOLD_BY` 컬럼이 있어 자재와 구조가 다릅니다.
