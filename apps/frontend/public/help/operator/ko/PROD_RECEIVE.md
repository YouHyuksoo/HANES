---
menuCode: PROD_RECEIVE
audience: operator
title: 제품입고 — 운영 가이드
summary: 포장 완료 박스(PACKED_WAITING)를 선택해 FG 창고에 입고하고, PRODUCT_TRANSACTIONS에 FG_IN 거래를 생성하며 PRODUCT_STOCKS 재고를 증가시킵니다.
tags: [제품수불관리, 완제품입고, 박스스캔, FG_IN]
keywords: [PROD_RECEIVE, FG_IN, FG_IN_CANCEL, PRODUCT_TRANSACTIONS, PRODUCT_STOCKS, FG_LABELS, BOX_NO, PACKED_WAITING, 순차처리, 이중입고가드]
related: [PROD_RECEIVE_CANCEL, PROD_STOCK]
---

# 제품입고 — 운영 가이드

## 시스템 목적·역할

포장 공정에서 박스 번호(BOX_NO)가 부여된 완제품(FG) 박스를 완제품 창고에 입고합니다.

- `FG_LABELS` 시리얼 기준으로 입고 대상을 파악합니다.
- 입고 성공 시 `PRODUCT_TRANSACTIONS`에 `FG_IN` 거래를 생성하고, `PRODUCT_STOCKS` 해당 품목+창고 재고를 증가시킵니다.
- 트랜잭션 번호 채번이 `SELECT MAX+1` 방식이므로 박스를 **순차 처리**하여 PK 충돌을 방지합니다.
- 백엔드에 이중입고 가드가 있어 동일 박스를 두 번 입고하면 409 오류로 차단됩니다.

## 데이터 구조

```
FG_LABELS (박스 발행·포장 추적)
  BOX_NO          ← 박스 식별 기준
  INVENTORY_STATE ← PACKED_WAITING → WAREHOUSE_RECEIVED
      |
      ↓ 입고 처리
PRODUCT_TRANSACTIONS (FG_IN / FG_IN_CANCEL 거래)
  TRANS_NO, TRANS_TYPE, TRANS_DATE
  ITEM_CODE, QTY
  TO_WAREHOUSE_ID
  ORDER_NO (작업지시 참조)
      |
      ↓ 집계
PRODUCT_STOCKS (품목+창고 현재고)
  COMPANY, PLANT_CD, WAREHOUSE_CODE, ITEM_CODE  ← 복합 PK
  CURRENT_QTY ← 입고 시 +, 취소 시 -
```

스코프: `COMPANY='40'`, `PLANT_CD='1000'`

## ① 입고 이력 그리드 — PRODUCT_TRANSACTIONS

조회 API: `GET /inventory/product/transactions?transType=FG_IN,FG_IN_CANCEL&fromDate=&toDate=&limit=1000`

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| **거래일자** | `TRANS_DATE` | 입고·취소 처리일. 기본값은 당일, 기간 변경 가능. |
| **거래번호** | `TRANS_NO` | PK. SELECT MAX+1 채번 → 병렬 처리 시 PK 충돌 위험, 순차처리 필수. |
| **유형** | `TRANS_TYPE` | `FG_IN`=입고, `FG_IN_CANCEL`=취소. |
| **품목코드** | `ITEM_CODE` (→ `ITEM_MASTERS.ITEM_CODE`) | 완제품 코드. |
| **품목명** | 조인: `ITEM_MASTERS.ITEM_NAME` | - |
| **창고** | `TO_WAREHOUSE_ID` / `FROM_WAREHOUSE_ID` → `WAREHOUSES.WAREHOUSE_NAME` | 입고=TO, 취소=FROM. |
| **수량** | `QTY` | 입고 양수, 취소 음수로 표시. |
| **작업지시번호** | `ORDER_NO` | 생산 추적용. NULL 가능. |
| **상태** | `STATUS` | PROD_RESULT_STATUS 공통코드 기반. |
| **멀티테넌시** | `COMPANY`, `PLANT_CD` | `40` / `1000` 고정 스코프. |

## ② 입고 가능 박스 목록 — FG_LABELS / BOX_STOCK

조회 API: `GET /shipping/box-stock` (클라이언트 측에서 `inventoryState === 'PACKED_WAITING'` 필터 적용)

| 화면 항목 | DB 출처 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| **박스번호** | `FG_LABELS.BOX_NO` | 포장 완료 시 발행된 박스 식별자(BX... 형식). |
| **품목명** | `ITEM_MASTERS.ITEM_NAME` | - |
| **수량** | `FG_LABELS.QTY` 또는 박스 집계 | 박스 내 완제품 수량. |
| **inventoryState** | `FG_LABELS.INVENTORY_STATE` | `PACKED_WAITING`만 목록에 표시됨. |

## 버튼·API·상태 전이

| 버튼/액션 | API | 허용 조건 | 결과 상태 / DB 영향 |
|------|------|------|------|
| **입고** | `POST /inventory/fg/receive` (완제품) | 박스 선택 ≥ 1 + 입고창고 선택 | `PRODUCT_TRANSACTIONS` FG_IN 생성, `PRODUCT_STOCKS` QTY 증가, `FG_LABELS.INVENTORY_STATE` → `WAREHOUSE_RECEIVED` |
| **스캔 확인** (Enter) | `GET /shipping/boxes/box-no/{boxNo}` (박스 미존재 확인용) | 스캔 입력 후 Enter | 목록에 있으면 선택 추가. 없으면 박스 상태 조회 후 메시지 표시 |
| **패널 새로 고침** | `GET /shipping/box-stock` | 항상 | 우측 입고 가능 박스 목록 갱신 |
| **그리드 새로 고침** | `GET /inventory/product/transactions` | 항상 | 좌측 이력 그리드 갱신 |

### 입고 처리 상세 (`receiveBoxes` 함수)

```
for each selectedBox:
  POST /inventory/fg/receive {
    warehouseId,
    itemCode,
    qty,
    refType: "BOX",
    refId: boxNo,
    remark: "박스입고:{boxNo}"
  }
  성공 → ok 목록 추가
  실패 → failed 목록 추가 (사유 포함)
  → 다음 박스 계속 처리
```

- 순차 처리(`await` 직렬): `TRANS_NO` SELECT MAX+1 채번 구조상 병렬 시 PK 충돌.
- 부분 성공: 일부 실패해도 나머지는 계속 처리 후 실패 목록을 화면에 표시.
- 이중입고 가드: 백엔드에서 `refId(boxNo)`가 이미 처리된 경우 409 반환.

## 상태 코드

### INVENTORY_STATE (FG_LABELS)

| 코드 | 의미 |
|------|------|
| `PACKED_WAITING` | 포장 완료, 아직 창고 미입고. 입고 가능 박스 목록에 표시됨. |
| `WAREHOUSE_RECEIVED` | 창고 입고 완료. 목록에서 제외됨. |

### TRANS_TYPE (PRODUCT_TRANSACTIONS)

| 코드 | 의미 |
|------|------|
| `FG_IN` | 완제품 입고 거래. QTY 양수. |
| `FG_IN_CANCEL` | 입고 취소 거래. QTY 음수. 입고취소 화면(`/product/receipt-cancel`)에서 생성. |

## 사전 설정 (마스터·공통코드)

| 항목 | 관리 위치 | 비고 |
|------|------|------|
| 완제품(FG) 창고 | 창고마스터(`WAREHOUSES`, `warehouseType='FG'`) | 입고창고 Select에 FG 타입만 표시 |
| 품목 마스터 | `ITEM_MASTERS` | `itemType='FINISHED'` 완제품 |
| 공통코드 PROD_RESULT_STATUS | 공통코드 관리 | 거래 상태 배지에 사용 |
| 공통코드 TRANSACTION_TYPE | 공통코드 관리 | 유형 배지(FG_IN, FG_IN_CANCEL) |

## 운영 절차

1. **입고 가능 박스 확인**: 우측 패널 새로 고침 → `PACKED_WAITING` 박스가 목록에 있는지 확인.
2. **스캔 또는 수동 선택**: 바코드 스캐너로 박스번호 스캔(Enter) 또는 목록 행 클릭.
3. **입고창고 지정**: 완제품 창고를 Select에서 선택.
4. **입고 실행**: [입고] 버튼 → 순차 처리 → 완료.
5. **결과 확인**: 좌측 이력 그리드에 `FG_IN` 거래 확인. 실패 건은 오류 목록 확인 후 재처리.
6. **재고 검증**: 제품현재고 화면(`/product/stock`)에서 해당 창고·품목 수량 증가 확인.

## 권한

- **일반 사용자**: 입고 이력 조회, 박스 스캔 및 입고 처리 가능.
- **관리자**: 입고취소 화면(`/product/receipt-cancel`)을 통해 취소 처리 가능.

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| 입고 가능 박스 목록이 비어 있음 | 포장 완료 박스(`PACKED_WAITING`)가 없거나 조회 실패 | 포장관리 화면에서 포장완료 처리 확인. 패널 새로 고침 재시도. |
| 스캔 시 "입고 불가능한 박스" 메시지 | `inventoryState`가 `PACKED_WAITING`이 아님 (이미 입고됐거나 취소됨) | `FG_LABELS.INVENTORY_STATE` 직접 조회해 현재 상태 확인. |
| 스캔 시 "박스 없음" 메시지 | 해당 `BOX_NO`가 `FG_LABELS`에 존재하지 않음 | 포장관리 화면에서 박스 발행 여부 확인. |
| 입고 시 일부 박스 실패(오류 목록) | 이중입고 시도(409), 창고·품목 마스터 불일치, 서버 오류 등 | 오류 메시지 확인 → 해당 박스 상태 재조회 → 문제 해소 후 재시도. |
| 재고가 반영되지 않음 | 입고 실패 또는 조회 캐시 | `PRODUCT_STOCKS` 직접 쿼리로 QTY 확인. 입고 이력에 `FG_IN` 거래 여부 대조. |
| 거래번호 PK 충돌 오류 | 동일 채번 요청이 동시에 들어온 경우 | `receiveBoxes`는 순차 처리하므로 단일 클라이언트에서는 발생 안 함. 동시 다발적 접속이 원인이면 순서 재시도. |
| `ORA-04068` (PL/SQL 패키지 INVALID) | DDL 변경 후 패키지 무효화 | `ALTER PACKAGE {패키지명} COMPILE` 실행. 다음 호출부터 정상 복구됨. |

## 데이터·연계

- **화면 경로**: `/product/receive`
- **MENU_CODE**: `PROD_RECEIVE`
- **주요 테이블**: `PRODUCT_TRANSACTIONS`, `PRODUCT_STOCKS`, `FG_LABELS`
- **연계 API**:
  - `GET /inventory/product/transactions` — 이력 조회
  - `GET /shipping/box-stock` — 입고 가능 박스 목록
  - `GET /shipping/boxes/box-no/{boxNo}` — 박스 단건 조회
  - `POST /inventory/fg/receive` — 완제품 입고
- **멀티테넌시**: `COMPANY='40'`, `PLANT_CD='1000'`
- **관련 화면**: 입고취소(`/product/receipt-cancel`), 포장관리(`/product/packing`), 제품현재고(`/product/stock`)
