---
menuCode: SHIP_ORDER
audience: operator
title: 출하지시관리 — 운영 가이드
summary: 출하지시(SHIPMENT_ORDERS) CRUD — 고객사·PO번호·출하일 지정, 품목 추가/수량 설정, DRAFT→CONFIRMED 확정, QR코드 A4 출력.
tags: [출하관리, 출하지시, SHIPMENT_ORDERS, CRUD]
keywords: [SHIPMENT_ORDERS, SHIPMENT_ORDER_ITEMS, DRAFT, CONFIRMED, SHIPPING, SHIPPED, CLOSED, SHIP_ORDER_STATUS, CUSTOMER, 출하지시, 확정, 확정취소, includeOpen]
related: [SHIP_PACK, SHIP_PALLET]
---

# 출하지시관리 — 운영 가이드

## 시스템 목적·역할

고객사에 출하할 완제품 품목·수량을 지정하는 **출하지시서(Ship Order)** 를 등록·관리합니다.

- DRAFT로 작성하고 CONFIRMED로 확정하면 포장·팔레트·출하 작업이 연계됩니다.
- 상태 흐름: `DRAFT → CONFIRMED → SHIPPING → SHIPPED → (CLOSED)`
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`

## 데이터 구조

```
SHIPMENT_ORDERS (PK: SHIP_ORDER_NO 자동채번)
   ├─ CUSTOMER_ID         → PARTNER_MASTERS (partnerType='CUSTOMER')
   ├─ CUSTOMER_NAME       (비정규화 캐시)
   ├─ CUSTOMER_PO_NO      VARCHAR2(100)
   ├─ DUE_DATE / SHIP_DATE
   ├─ STATUS              SHIP_ORDER_STATUS 공통코드
   ├─ REMARK
   ├─ COMPANY / PLANT_CD  멀티테넌시 스코프
   └─ CREATED_BY / CREATED_AT / UPDATED_BY / UPDATED_AT

SHIPMENT_ORDER_ITEMS (PK: SHIP_ORDER_ID + SEQ)
   ├─ ITEM_CODE           → ITEM_MASTERS (itemType='FINISHED')
   ├─ ORDER_QTY           지시 수량 (정수 > 0)
   ├─ SHIPPED_QTY         누적 출하 수량 (출하 시 증가)
   ├─ REMARK
   └─ COMPANY / PLANT_CD
```

## ① 출하지시 목록 그리드 — SHIPMENT_ORDERS

조회 API: `GET /shipping/orders?limit=5000&shipDateFrom=&shipDateTo=&search=&status=&includeOpen=true`

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| **출하지시번호** | `SHIP_ORDER_NO` | PK. 자동채번. 그리드 행 선택 기준. |
| **고객사** | `CUSTOMER_ID` → `PARTNER_MASTERS.PARTNER_NAME` | `partnerType='CUSTOMER'` 필터. |
| **고객 PO번호** | `CUSTOMER_PO_NO` | 없으면 `-`. 텍스트 검색 가능. |
| **납기일** | `DUE_DATE` | 고객 납품 기한. NULL 허용. |
| **출하일** | `SHIP_DATE` | 출하 예정일. 필수. 기간 필터 기준. |
| **품목수** | `itemCount` (집계) | 연결된 `SHIPMENT_ORDER_ITEMS` 행 수. |
| **총수량** | `totalQty` (집계) | `ORDER_QTY` 합산. |
| **상태** | `STATUS` | SHIP_ORDER_STATUS 공통코드 배지. |
| **멀티테넌시** | `COMPANY`, `PLANT_CD` | 40 / 1000 고정 스코프. |

### includeOpen 동작

상태 필터를 지정하지 않으면 `includeOpen=true` 파라미터가 함께 전송됩니다.
서버는 출하일이 조회 기간 밖이더라도 `STATUS IN ('DRAFT','CONFIRMED','SHIPPING')`인 지시를 결과에 포함합니다.
화면에서는 기간 밖 미완료 행을 왼쪽 주황색 테두리(`border-l-2 border-l-amber-500`)로 구분하고, 상단에 건수 알림을 표시합니다.

## ② 등록·수정 패널 — SHIPMENT_ORDERS + SHIPMENT_ORDER_ITEMS

| 화면 항목 | DB 컬럼 | 필수 | 운영 포인트 |
|------|------|:----:|------|
| **출하지시번호** | `SHIP_ORDER_NO` | — | 등록 시 자동생성. 수정 불가. |
| **거래처** | `CUSTOMER_ID` | | `partnerType='CUSTOMER'` 파트너만 선택 가능. |
| **고객 PO번호** | `CUSTOMER_PO_NO` | | 최대 100자. |
| **납기일** | `DUE_DATE` | | 미입력 시 NULL 저장. |
| **출하일** | `SHIP_DATE` | ✓ | 미입력 시 저장 불가. |
| **비고** | `REMARK` | | 자유 텍스트. |
| **품목(itemCode)** | `SHIPMENT_ORDER_ITEMS.ITEM_CODE` | ✓(≥1) | `itemType='FINISHED'` 완제품만. 동일 품목 중복 불가. |
| **수량(orderQty)** | `SHIPMENT_ORDER_ITEMS.ORDER_QTY` | ✓ | 정수 > 0. `QtyInput` 컴포넌트(천단위 표시). |
| **품목 비고** | `SHIPMENT_ORDER_ITEMS.REMARK` | | 품목별 메모. |

## 버튼·API·상태 전이

| 버튼/액션 | API | 허용 조건 | 결과 상태 / DB 영향 |
|------|------|------|------|
| **등록(저장)** | `POST /shipping/orders` | 출하일 + 품목 ≥ 1 + 모든 orderQty > 0 | `SHIPMENT_ORDERS` INSERT (STATUS=DRAFT) + `SHIPMENT_ORDER_ITEMS` INSERT |
| **수정(저장)** | `PUT /shipping/orders/:id` | STATUS=DRAFT | `SHIPMENT_ORDERS` UPDATE + `SHIPMENT_ORDER_ITEMS` 전체 교체 |
| **저장 후 확정** | `POST` → `PUT .../confirm` | DRAFT + 품목 ≥ 1 | 저장 완료 후 즉시 CONFIRMED 전환 (2회 API 호출) |
| **확정** (헤더) | `PUT /shipping/orders/:id/confirm` | STATUS=DRAFT + 품목 ≥ 1 | DRAFT → CONFIRMED |
| **확정취소** | `PUT /shipping/orders/:id/unconfirm` | STATUS=CONFIRMED | CONFIRMED → DRAFT. 연결 박스·팔레트가 있으면 서버에서 차단 |
| **삭제** | `DELETE /shipping/orders/:id` | STATUS=DRAFT | `SHIPMENT_ORDERS` + `SHIPMENT_ORDER_ITEMS` DELETE |
| **출력** | (브라우저 `window.print()`) | 행 선택 | A4 portrait 출하지시서 인쇄. QR코드=SHIP_ORDER_NO |
| **새로 고침** | `GET /shipping/orders` | 항상 | 현재 필터 조건으로 목록 재조회 |

## 상태 코드 (SHIP_ORDER_STATUS)

| 코드 | 화면 라벨 | 의미 | 허용 작업 |
|------|------|------|------|
| `DRAFT` | 임시저장 | 작성 중, 확정 전 | 수정·삭제·확정 |
| `CONFIRMED` | 확정 | 확정 완료 | 박스 출하·팔레트 적재·확정취소 |
| `SHIPPING` | 출하중 | 출고 진행 중 | 부분 출하 처리 |
| `SHIPPED` | 출하완료 | 전량 출하 완료 | 조회·출력만 |
| `CLOSED` | 마감 | 마감 처리 완료 | 조회·출력만 |

## 저장 조건 인터록

| 조건 | 차단 동작 |
|------|------|
| 출하일 미입력 | [저장], [저장 후 확정] 버튼 비활성 |
| 품목 0개 | [저장], [저장 후 확정], [확정] 버튼 비활성 |
| 품목 수량 ≤ 0 또는 소수 | [저장], [저장 후 확정] 버튼 비활성 |
| STATUS ≠ DRAFT | [수정(저장)] 버튼 비활성, 필드 편집 불가 |
| STATUS = CONFIRMED + 연결 박스·팔레트 있음 | 확정취소 API 서버 차단 |

## 사전 설정 (마스터·공통코드)

| 항목 | 관리 위치 | 비고 |
|------|------|------|
| 고객사(거래처) | `PARTNER_MASTERS` (`partnerType='CUSTOMER'`) | 거래처 Select에 CUSTOMER 유형만 표시 |
| 완제품 품목 | `ITEM_MASTERS` (`itemType='FINISHED'`) | 품목 추가 팝업에 FINISHED만 노출 |
| 공통코드 SHIP_ORDER_STATUS | 공통코드 관리 | DRAFT, CONFIRMED, SHIPPING, SHIPPED, CLOSED |

## 운영 절차

1. **일일 조회**: 출하일 기간을 오늘로 설정하고 CONFIRMED 상태 지시를 확인합니다.
2. **기간 밖 미완료 알림**: 상단 주황색 알림 건수가 있으면 해당 행(주황 테두리)을 검토해 처리를 완료하거나 출하일을 조정합니다.
3. **신규 등록**: [등록] → 패널에서 거래처·출하일·품목 입력 → [저장 후 확정] 또는 [저장].
4. **확정 처리**: 작성 완료된 DRAFT 지시를 행 클릭 → 헤더 [확정] → 확인 팝업.
5. **확정취소**: 오입력 발견 시 행 클릭 → 헤더 [확정취소] → DRAFT 복귀 → 수정 → 재확정.
6. **출하지시서 인쇄**: 행 클릭 → 헤더 [출력] → A4 QR코드 포함 인쇄.

## 권한

- **일반 사용자**: 출하지시 조회·등록·수정(DRAFT)·확정·출력.
- **관리자**: 확정취소, 삭제, 기준 데이터 관리.

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| 저장 버튼이 비활성 | 출하일 미입력 또는 품목 없음 또는 수량 ≤ 0 | 출하일, 품목, 수량 필수값 확인 |
| 확정 버튼이 비활성 | 행 미선택 또는 STATUS ≠ DRAFT 또는 품목 없음 | 행 먼저 클릭 → 상태·품목 확인 |
| 확정취소 실패 | 연결된 박스·팔레트가 있어 서버에서 차단 | 포장관리·팔레트 화면에서 해당 할당 해제 후 재시도 |
| 기간 밖 지시가 목록에 보임 | `includeOpen=true` 자동 포함 | 상태 필터를 지정하면 기간 밖 자동 포함 중단. 또는 해당 지시를 출하완료 처리 |
| 품목 검색 팝업에서 품목 없음 | `itemType ≠ 'FINISHED'` | 품목마스터에서 해당 품목의 itemType 확인 |
| 출력(인쇄) 화면이 열리지 않음 | 브라우저 팝업 차단 | 브라우저 팝업 허용 설정 → 재시도 |
| 저장 API 500 오류 | 서버 오류 또는 필수값 누락 | 서버 로그 확인. `SHIP_DATE` NULL 여부, `ITEM_CODE` 존재 여부 점검 |

## 데이터·연계

- **화면 경로**: `/shipping/order`
- **MENU_CODE**: `SHIP_ORDER`
- **주요 테이블**: `SHIPMENT_ORDERS`, `SHIPMENT_ORDER_ITEMS`
- **참조 테이블**: `PARTNER_MASTERS` (고객사), `ITEM_MASTERS` (완제품)
- **연계 API**:
  - `GET /shipping/orders` — 목록 조회
  - `POST /shipping/orders` — 등록
  - `PUT /shipping/orders/:id` — 수정
  - `PUT /shipping/orders/:id/confirm` — 확정
  - `PUT /shipping/orders/:id/unconfirm` — 확정취소
  - `DELETE /shipping/orders/:id` — 삭제
- **멀티테넌시**: `COMPANY='40'`, `PLANT_CD='1000'`
- **연계 화면**: 포장관리(`/shipping/pack`), 팔레트적재(`/shipping/pallet`)
