---
menuCode: SHIP_ORDER
audience: operator
title: 출하지시등록 — 운영 가이드
summary: 출하지시 CRUD — 고객사·PO번호·출하일 지정, 품목 추가/수량 설정, DRAFT→CONFIRMED 확정, QR코드 출력
tags: [출하, 출하지시, 선적, CRUD]
keywords: [SHIPMENT_ORDERS, SHIPMENT_ORDER_ITEMS, DRAFT, CONFIRMED, SHIPPED, CLOSED, SHIP_ORDER_STATUS, CUSTOMER, 출하지시, 출하, 선적, 고객사]
related: [SHIP_PACK, SHIP_PALLET]
---

# 출하지시등록 — 운영 가이드

## 시스템 목적·역할
고객사에 출하할 품목과 수량을 지정하는 **출하지시(Ship Order)** 를 등록·관리하는 화면입니다. DRAFT 상태에서 작성·수정 후 CONFIRMED로 확정하면 이후 박스 출하·팔레트적재 작업을 진행할 수 있습니다.

```
DRAFT → CONFIRMED → SHIPPING → SHIPPED → CLOSED
```

## 데이터 구조
```
SHIPMENT_ORDERS (PK: SHIP_ORDER_NO, 자동채번)
   ├─ CUSTOMER_ID → PARTNER_MASTERS (거래처)
   ├─ CUSTOMER_PO_NO (고객 PO번호)
   ├─ DUE_DATE / SHIP_DATE
   └─ STATUS: DRAFT → CONFIRMED → SHIPPING → SHIPPED → CLOSED

SHIPMENT_ORDER_ITEMS (PK: SHIP_ORDER_ID + SEQ)
   ├─ ITEM_CODE → ITEM_MASTERS (완제품 FINISHED)
   ├─ ORDER_QTY / SHIPPED_QTY
   └─ REMARK
```

## 화면 구성

### 메인 영역
- **헤더**: 제목 + 새로고침·등록 버튼
- **DataGrid**: `GET /shipping/orders?limit=5000`
  - 컬럼: 액션·출하지시번호·고객사·PO번호·납기일·출하일·품목수·총수량·상태
  - 액션: 출력·확정(DRAFT만)·수정(DRAFT만)·삭제(DRAFT만)
  - 상태 헤더 우측 `HelpCircle` → 툴팁으로 상태별 설명
  - 검색: 출하지시번호, 상태 필터

### 우측 패널 (480px)
| 항목 | 설명 |
|------|------|
| 출하지시번호 | 자동생성 (수정 시 표시) |
| 거래처 | `CUSTOMER` 유형 파트너 선택 |
| 고객 PO번호 | 수동 입력 (최대 100자) |
| 납기일 / 출하일 | date picker (출하일 필수) |
| 비고 | 자유 텍스트 |
| 품목 목록 | `+` 버튼 → `PartSearchModal`(FINISHED) |
| 품목 카드 | 품목코드·명·단위, 수량(`QtyInput`), 비고, 삭제 |
| 합계 | 품목 수, 총 수량 |

### 인쇄 영역 (출하지시서)
- `Printer` 아이콘 클릭 → A4 portrait 포맷 출력
- QR코드(출하지시번호), 고객정보, 품목 테이블
- `@media print` CSS로 화면에서는 숨김

## 작업 흐름

### ① 출하지시 작성 (POST /shipping/orders)
- 우측 패널에서 거래처·출하일·품목 입력
- 품목 중복 추가 불가 (itemCode 기준)
- 모든 품목에 `orderQty > 0` + 출하일 입력 필수

### ② 출하지시 수정 (PUT /shipping/orders/:id)
- **DRAFT 상태만** 수정 가능
- 품목 추가/삭제/수량 변경 가능

### ③ 출하지시 확정 (PUT /shipping/orders/:id/confirm)
- DRAFT → CONFIRMED 전환
- 확정 후 수정·삭제 불가
- 품목이 1개 이상 있어야 확정 가능

### ④ 출하지시 삭제 (DELETE /shipping/orders/:id)
- **DRAFT 상태만** 삭제 가능

### ⑤ 출하지시서 출력
- 모든 상태에서 출력 가능
- QR코드 포함 A4 인쇄

## 상태 코드 (SHIP_ORDER_STATUS)

| 코드 | 의미 | 작업 가능 |
|------|------|-----------|
| DRAFT | 작성 중 | 수정·삭제·확정 |
| CONFIRMED | 확정 | 박스출하·팔레트적재 |
| SHIPPING | 출하 진행 중 | 부분 출하 |
| SHIPPED | 출하 완료 | 조회만 |
| CLOSED | 마감 | 조회만 |

## 인터록

| 조건 | 설명 |
|------|------|
| 출하일 미입력 | 저장 버튼 비활성화 |
| 품목 수량 0 | 저장 버튼 비활성화 |
| CONFIRMED 이후 | 수정·삭제 불가 (확정 버튼 숨김) |
| 확정 시 품목 없음 | 확정 버튼 비활성화 + 툴팁 |

## 문제 해결

| 증상 | 원인 | 조치 |
|------|------|------|
| 품목 선택 안 됨 | PartSearchModal 필터 확인 | 완제품(FINISHED)만 선택 가능 |
| CONFIRMED 안 됨 | 품목 없음 | 품목 1개 이상 추가 |
| 출력 안 됨 | 브라우저 팝업 차단 | 팝업 허용 |
| 저장 실패 | 필수값 누락 | 출하일·품목 수량 확인 |

## 데이터·연계
- 테이블: `SHIPMENT_ORDERS`, `SHIPMENT_ORDER_ITEMS`, `PARTNER_MASTERS`, `ITEM_MASTERS`
- 연계: 제품포장(`/shipping/pack`) → 팔레트적재(`/shipping/pallet`) → 출하
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
