---
menuCode: PROD_WIP_MAT_TRANS
audience: operator
title: 원자재공정수불 — 운영 가이드
summary: WIP_MAT_TRANSACTIONS 전체 컬럼, 공정 수불 유형별 의미, WIP 재고 연동 구조와 트러블슈팅
tags: [생산, WIP, 공정, 수불, 운영, 설비]
keywords: [WIP_MAT_TRANSACTIONS, WIP_MAT_STOCKS, 공정수불, WIP_IN, PROD_CONSUME, CANCEL_REF_ID, 설비별재고, EQUIP_CODE, ITEM_MASTERS, EQUIP_MASTERS]
related: [PROD_ORDER, PROD_INPUT_KIOSK]
---

# 원자재공정수불 — 운영 가이드

## 시스템 목적·역할
설비(공정) 단위로 관리되는 원자재 공정재고(WIP)의 모든 거래 내역을 `WIP_MAT_TRANSACTIONS` 테이블에서 조회합니다. 원자재가 `WIP_MAT_STOCKS`(공정재고)로 입고되거나 생산에 소비될 때마다 자동으로 기록되며, 취소 시에는 `CANCEL_REF_ID`로 원본과 연결됩니다. 공정재고 흐름의 투명한 추적과 감사를 지원합니다.

## 데이터 구조
```
WIP_MAT_TRANSACTIONS (PK: TRANS_NO — WTXYYMMDD-NNNNN)
    │
    ├── 기본정보: TRANS_TYPE, QTY, STATUS
    ├── 설비: EQUIP_CODE → EQUIP_MASTERS (equipName)
    ├── 품목/LOT: ITEM_CODE → ITEM_MASTERS, MAT_UID → MAT_LOTS
    ├── 참조: REF_TYPE + REF_ID (ORDER_NO 등 원본 참조)
    └── 취소체인: CANCEL_REF_ID → WIP_MAT_TRANSACTIONS.TRANS_NO
            │
            └── WIP_MAT_STOCKS (PK: COMPANY + PLANT_CD + EQUIP_CODE + ITEM_CODE + MAT_UID)
                    ├── QTY (총 공정재고)
                    ├── AVAILABLE_QTY (가용)
                    └── RESERVED_QTY (예약)
```

---

## ① 공정수불 — WIP_MAT_TRANSACTIONS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 거래번호 | `TRANS_NO` | **PK**. 공정 수불 고유 식별자. 패턴: `WTXYYMMDD-NNNNN`. |
| 거래유형 | `TRANS_TYPE` | `WIP_IN` / `WIP_IN_CANCEL` / `PROD_CONSUME` / `PROD_CONSUME_CANCEL`. |
| 설비코드 | `EQUIP_CODE` | 거래가 발생한 설비. `EQUIP_MASTERS.EQUIP_CODE` 참조. |
| 품목코드 | `ITEM_CODE` | 거래 대상 원자재. `ITEM_MASTERS.ITEM_CODE` 참조. |
| LOT번호 | `MAT_UID` | 대상 LOT 시리얼번호. `MAT_LOTS.MAT_UID` 참조. |
| 수량 | `QTY` | 변동 수량. WIP_IN(+), PROD_CONSUME(-), 취소 시 역부호. |
| 출고창고 | `FROM_WAREHOUSE_ID` | WIP_IN 시 원자재를 공급한 자재창고. |
| 작업지시번호 | `ORDER_NO` | 연관된 작업지시(ProdOrder) 번호. |
| 참조유형 | `REF_TYPE` | 원본 문서 유형(예: WORK_ORDER). |
| 참조ID | `REF_ID` | 원본 문서 번호. |
| 취소참조 | `CANCEL_REF_ID` | 취소 시 원본 `TRANS_NO` 참조. NULL = 정상 거래. |
| 상태 | `STATUS` | `DONE`(정상) / `CANCELED`(취소). 기본 `DONE`. |
| 비고 | `REMARK` | 추가 메모. |
| 작업자 | `WORKER_NO` | 거래 처리 작업자 ID. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | 회사코드(`40`) / 플랜트코드(`1000`) 스코프. |
| 생성일시 | `CREATED_AT` | 거래 등록 시각. 목록의 일시 컬럼에 표시됨. |
| 수정일시 | `UPDATED_AT` | 최종 수정 시각. |

---

## 거래유형 상세

| 유형 | 설명 | QTY 부호 | WIP_MAT_STOCKS 효과 |
|------|------|---------|-------------------|
| WIP_IN | 자재창고 → 설비공정으로 원자재 투입 | + | 공정재고 증가 |
| WIP_IN_CANCEL | WIP_IN 취소 — 원자재를 자재창고로 회수 | - | 공정재고 감소 |
| PROD_CONSUME | 설비에서 원자재 생산 소비(실투입) | - | 공정재고 감소 |
| PROD_CONSUME_CANCEL | PROD_CONSUME 취소 — 소비 원복 | + | 공정재고 증가 |

---

## WIP 재고 연동 구조

`WipMatStockService`의 주요 메서드와 거래 유형 간 관계:

| 서비스 메서드 | 생성하는 TRANS_TYPE | WIP_MAT_STOCKS |
|-------------|-------------------|----------------|
| `addStockInTx()` | WIP_IN | `QTY` +, `AVAILABLE_QTY` + |
| `deductStockInTx()` | PROD_CONSUME | FIFO 차감(LOT 우선순위 지정 가능) |
| `restoreInTx()` — ADD_BACK | WIP_IN_CANCEL | 취소 복원 |
| `restoreInTx()` — DEDUCT_BACK | PROD_CONSUME_CANCEL | 취소 복원 |

> `addStockInTx`는 `WIP_MAT_STOCKS`에 해당 `EQUIP_CODE + ITEM_CODE + MAT_UID` 조합이 없으면 UPSERT(신규 생성하거나 기존에 누적)합니다.

---

## 취소 체인 구조

```
원본 WIP_IN (TRANS_NO = 'WTX20250601-00001', QTY = +100)
    │
    ├── 취소 시 → WIP_IN_CANCEL 생성 (QTY = -100, CANCEL_REF_ID = 원본.TRANS_NO)
    │              원본 STATUS = 'CANCELED'
    │
    └── WIP_MAT_STOCKS에서 해당 LOT 수량 -100
```

---

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| 조회 결과가 없음 | 필터 조건이 너무 좁음(설비·유형·일자) | 필터를 초기화하거나 범위를 넓혀 재조회 |
| 특정 설비 거래가 안 보임 | 설비 필터가 다른 설비로 선택됨 | 설비 선택 필터 확인 |
| 수량이 0 또는 NULL | 취소로 인해 원본 STATUS가 CANCELED | `CANCEL_REF_ID`로 취소 체인 확인 |
| LOT 번호가 표시 안 됨 | `MAT_UID`가 NULL인 거래 | LOT 단위 미적용 거래(수량 기준 처리) |
| 비고가 없음 | `REMARK`에 값이 없음 | 필수 항목 아님, 정상 |

## 데이터·연계
- **테이블**: `WIP_MAT_TRANSACTIONS` (거래원장), `WIP_MAT_STOCKS` (공정재고), `EQUIP_MASTERS` (설비), `ITEM_MASTERS` (품목)
- **연계**: 작업지시(`PROD_ORDER`), 자재입고/출고, 생산실적 입력
- **스코프**: `COMPANY='40'`, `PLANT_CD='1000'`
- **채번**: `SEQ_WIP_TX.NEXTVAL` → `WTXYYMMDD-NNNNN` 형식
