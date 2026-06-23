---
menuCode: SHIP_PALLET_SHIP
audience: operator
title: 팔레트출하 — 운영 가이드
summary: PALLET_MASTERS·SHIPMENT_LOGS의 출하확정 프로세스, 재고 차감 로직, 트랜잭션 구조와 트러블슈팅
tags: [출하, 팔레트, 출하확정, 운영, SHIPPED, 재고]
keywords: [SHIP_PALLET_SHIP, PALLET_MASTERS, SHIPMENT_LOGS, SHIPMENT_ORDER, PALLET_NO, CLOSED, SHIPPED, 출하확정, FG재고차감, FIFO]
related: [SHIP_ORDER, SHIP_PALLET]
---

# 팔레트출하 — 운영 가이드

## 시스템 목적·역할
적재 완료(CLOSED) 상태의 팔레트를 출하 확정(SHIPPED) 처리합니다. **출하번호 자동 채번** → `ShipmentLog` 생성 → `PalletMaster.STATUS='SHIPPED'` → `BoxMaster.STATUS='SHIPPED'` → `FgLabel.STATUS='SHIPPED'` → **FG 재고 차감(FIFO)** → `ShipmentOrderItem.shippedQty` 증가 → 전 품목 완출 시 `ShipmentOrder.STATUS='CLOSED'`까지 하나의 트랜잭션으로 처리됩니다.

## 데이터 구조
```
ShipmentOrder (출하지시, STATUS=CONFIRMED)
    │
    ├── ShipmentOrderItem (품목별 출하수량)
    │
    └── PALLET_MASTERS (PK: COMPANY + PLANT_CD + PALLET_NO)
            │   STATUS: OPEN → CLOSED → SHIPPED
            │   BOX_COUNT, TOTAL_QTY
            │   SHIP_ORDER_NO (→ ShipmentOrder)
            │   SHIPMENT_ID (→ ShipmentLog.SHIP_NO)
            │
            ├── BOX_MASTERS (PK: COMPANY + PLANT_CD + BOX_NO)
            │       STATUS: OPEN → CLOSED → SHIPPED
            │       PART_CODE, QTY
            │
            └── FG_LABELS (시리얼 존재 시)
                    STATUS: SHIPPED
```

---

## ① 팔레트 마스터 — PALLET_MASTERS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 팔레트번호 | `PALLET_NO` | **PK (3/3)**. 팔레트 고유 식별자. |
| 박스 수 | `BOX_COUNT` | 팔레트 적재 박스 수. |
| 총 수량 | `TOTAL_QTY` | 전체 제품 수량(박스 QTY 합계). |
| 상태 | `STATUS` | `OPEN` / `CLOSED` / `LOADED` / `SHIPPED`. CLOSED만 출하 가능. |
| 적재완료시각 | `CLOSE_TIME` | 팔레트 CLOSED 시각. |
| 출하시각 | `SHIPPED_TIME` | SHIPPED 시각. |
| 출하번호 | `SHIPMENT_ID` | `ShipmentLog.SHIP_NO` 참조(출하확정 시 설정). |
| 출하지시번호 | `SHIP_ORDER_NO` | `ShipmentOrder.SHIP_ORDER_NO` 참조. |
| 적재작업자 | `LOADED_BY` | 적재 완료 작업자. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | **PK (1,2/3)**. 회사코드(`40`) / 플랜트코드(`1000`). |
| 생성자 | `CREATED_BY` | 팔레트 생성자. |
| 수정자 | `UPDATED_BY` | 최종 수정자. |

---

## ② 출하 로그 — SHIPMENT_LOGS (전체 컬럼)

| DB 컬럼 | 역할 / 의미 |
|---------|------|
| `SHIP_NO` | **PK (3/3)**. 출하번호(시퀀스 자동 채번). |
| `SHIP_DATE` | 출하일자. |
| `SHIP_TIME` | 출하시각(트랜잭션 시점). |
| `DESTINATION` | 도착지(출하지시 참조). |
| `CUSTOMER` | 거래처(출하지시 참조). |
| `SHIP_ORDER_NO` | 출하지시번호. |
| `PALLET_COUNT` | 출하 팔레트 수. |
| `BOX_COUNT` | 출하 박스 수. |
| `TOTAL_QTY` | 총 출하 수량. |
| `STATUS` | `LOADED`(적재완료 출하) / `SHIPPED`(출하확정) |
| `ERP_SYNC_YN` | ERP 연동 여부(`Y`/`N`). |
| `COMPANY`, `PLANT_CD` | **PK (1,2/3)**. |

---

## 출하확정 트랜잭션 상세

`POST /shipping/orders/:id/ship-pallets` 호출 시 `ShipOrderService.shipOrderPallets()` 실행:

1. **검증 단계**:
   - 출하지시 `status === 'CONFIRMED'` 확인
   - 요청 품목과 출하지시 품목 일치 확인
   - 각 `PALLET_NO`의 `status === 'CLOSED'` 확인
   - `shipmentId === null` (미출하) 확인
   - 팔레트 하위 박스 모두 `CLOSED` + OQC PASS 상태 확인
   - 시리얼 목록과 박스 qty 일치 확인

2. **트랜잭션 내 실행**:
   - 출하번호 채번 → `ShipmentLog` 생성 (status=`LOADED`)
   - `PalletMaster` 업데이트: `shipmentId=shipNo, status='SHIPPED', shippedTime=now`
   - `BoxMaster` 업데이트: `status='SHIPPED', shippedAt=now`
   - `FgLabel` 업데이트: `status='SHIPPED'` (시리얼 존재 시)
   - `ProductInventory.issueStockByItemFifoInTx()` — FIFO 방식 FG 재고 차감
   - `ShipmentOrderItem.shippedQty += box.qty`
   - 전 품목 완출 시 `ShipmentOrder.status = 'CLOSED'`

---

## 상태 흐름

```
OPEN (팔레트 생성)
  │
  ▼
CLOSED (적재완료 = 출하가능)
  │
  ▼ [팔레트출하 화면에서 스캔 + 출하확정]
SHIPPED (출하확정)
  ├── 재고 차감 완료
  ├── BoxMaster.STATUS → SHIPPED
  └── 출하지시 전품목 출하완료 시 → ShipmentOrder.CLOSED
```

---

## 권한
출하 처리 권한(출하/창고 담당자). 조회는 전체 사용자.

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| 출하지시 목록이 비어 있음 | CONFIRMED 상태의 지시 없음 | 출하지시 등록 → 확인(승인) 처리 |
| 팔레트 스캔이 안 됨 | 팔레트가 CLOSED 상태가 아님 | 팔레트적재 화면에서 적재 완료 처리 |
| "이미 출하된 팔레트" 오류 | 팔레트가 이미 SHIPPED 상태 | 출하이력 확인 |
| 출하확정 버튼 비활성화 | 유효한 팔레트 미입력 | 팔레트 번호 스캔 또는 입력 |
| 재고 차감 실패 | 재고 부족 | FG 재고 확인 후 보충 |
| 시리얼 불일치 오류 | 시리얼 목록과 박스 qty 불일치 | 시리얼 스캔 내역 확인 |

## 데이터·연계
- **테이블**: `PALLET_MASTERS`, `BOX_MASTERS`, `SHIPMENT_LOGS`, `SHIPMENT_ORDER`, `SHIPMENT_ORDER_ITEM`, `FG_LABEL`
- **연계**: FG 재고(FIFO 차감), ERP 연동(`ERP_SYNC_YN`)
- **스코프**: `COMPANY='40'`, `PLANT_CD='1000'`
