---
menuCode: PUR_PO
audience: operator
title: PO관리 — 운영 가이드
summary: PURCHASE_ORDERS / PURCHASE_ORDER_ITEMS 테이블 구조, 상태 전이 로직, 채번 규칙, 멀티테넌시 스코프, 트러블슈팅 포함
tags: [자재관리, 구매발주, PO, 운영, 마스터]
keywords: [PURCHASE_ORDERS, PURCHASE_ORDER_ITEMS, PO_NO, PARTNER_ID, PARTNER_NAME, ORDER_DATE, DUE_DATE, STATUS, USE_TYPE, TOTAL_AMOUNT, LINE_NO, REV_NO, SEQ, ORDER_QTY, RECEIVED_QTY, LINE_STATUS, REL_NO, UNIT_PRICE, DRAFT, CONFIRMED, PARTIAL, RECEIVED, CLOSED, 채번, 멀티테넌시, COMPANY, PLANT_CD, 입하, 수입검사]
related: [PUR_PO_STATUS, MAT_RECEIVE, MST_PART]
---

# PO관리 — 운영 가이드

## 시스템 목적·역할
구매발주(PO)의 전체 생명주기를 관리하는 자재관리 모듈의 핵심 화면입니다. 등록된 PO는 입하관리(MAT_RECEIVE)에서 입고 처리 시 참조되며, 상태가 PARTIAL/RECEIVED로 자동 갱신됩니다. PO가 없으면 입하 처리가 불가능한 구조입니다.

## 데이터 구조

```
PURCHASE_ORDERS (PK: PO_NO)
  ├─ PARTNER_ID ──▶ PARTNER_MASTERS (공급업체)
  └─ PURCHASE_ORDER_ITEMS (PK: PO_ID + SEQ)
       └─ ITEM_CODE ──▶ ITEM_MASTERS (품목마스터)
       └─ 참조: MAT_ARRIVALS (입하 연계)
```

## ① PO 헤더 — PURCHASE_ORDERS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| PO No. | `PO_NO` | PK(자연키). 채번 규칙: `PO-YYYYMMDD-NNN` (NumberingService). 불변 — 생성 후 변경 불가. |
| 거래처(ID) | `PARTNER_ID` | `PARTNER_MASTERS.PARTNER_CODE` 참조. 화면에서는 이름(`partnerName`)을 표시. |
| 거래처명 | `PARTNER_NAME` | 등록 시 `PARTNER_ID` 기준으로 마스터에서 조회해 자동 기입. 거래처 이름이 추후 바뀌어도 PO 기록은 등록 시점 이름을 유지. |
| 발주일 | `ORDER_DATE` | date 타입. 기본값 등록 시점 오늘. 목록 필터 기준 컬럼(`@Index`). |
| 납기일 | `DUE_DATE` | date 타입. nullable. 입하 납기 준수율 분석에 사용. |
| 상태 | `STATUS` | 상태 흐름(아래 참조). 기본값 `DRAFT`. 공통코드 `PO_STATUS`. `@Index` 존재. |
| 용도유형 | `USE_TYPE` | 발주 목적 구분. 현재 기본값 `PROD`(생산용). UI에는 노출되지 않음. |
| 총금액 | `TOTAL_AMOUNT` | decimal(14,2). 품목별 `ORDER_QTY × UNIT_PRICE` 합산. 단가 미입력 시 0. 저장 시점에 서비스 레이어에서 계산. |
| 비고 | `REMARK` | varchar2(500). |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | 스코프: `'40'` / `'1000'`. 모든 조회/저장에 적용. |
| 등록자 | `CREATED_BY` | 세션 사용자 ID. |
| 수정자 | `UPDATED_BY` | 수정 시 세션 사용자 ID. |
| 감사 | `CREATED_AT`, `UPDATED_AT` | timestamp. TypeORM `@CreateDateColumn` / `@UpdateDateColumn`. |

## ② PO 품목 — PURCHASE_ORDER_ITEMS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| (없음) | `PO_ID` | PK 구성(복합). `PURCHASE_ORDERS.PO_NO` 참조. 엔티티 필드명은 `poNo`. |
| (없음) | `SEQ` | PK 구성(복합). 품목 저장 순서(0-based index + 1). |
| 품목코드 | `ITEM_CODE` | `ITEM_MASTERS.ITEM_CODE` 참조. `@Index` 존재. |
| 발주수량 | `ORDER_QTY` | int. 1 이상 정수 필수. |
| 입고수량 | `RECEIVED_QTY` | int. 기본값 0. 입하 처리 시 자동 누적됨. 화면(PO 등록)에서는 수정 불가 — 입하관리에서만 변경됨. |
| 라인번호 | `LINE_NO` | 사용자가 지정하는 발주 라인 식별 번호. 기본값은 추가 순서. |
| 릴리즈번호 | `REV_NO` | 동일 품목의 발주 차수. 기본값 1. 화면 레이블: "릴리즈번호". |
| 라인상태 | `LINE_STATUS` | 기본값 `OPEN`. 입고 진행에 따라 변경(운영 참고). 화면에는 노출 없음. |
| 릴리즈 No. | `REL_NO` | nullable int. ERP 등 외부 시스템 릴리즈 참조용. 현재 화면 미노출. |
| 단가 | `UNIT_PRICE` | decimal(12,4). nullable. 화면 입력 UI 없음(API 직접 또는 향후 확장). 총금액 계산에 사용. |
| 비고 | `REMARK` | varchar2(500). 품목 라인별 메모. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | 헤더와 동일 스코프 자동 적용. |
| 감사 | `CREATED_AT`, `UPDATED_AT` | timestamp. |

## 상태 전이 로직

| 전이 | API 경로 | 조건 | 비고 |
|------|------|------|------|
| DRAFT → CONFIRMED | `PATCH /material/purchase-orders/:id/confirm` | 현재 상태 `DRAFT`만 가능 | 발주 확정. 이후 입하 가능. |
| CONFIRMED → PARTIAL | (입하 처리 시 자동) | 일부 품목 입고 완료 | MAT_ARRIVALS 처리 시 자동 변경 |
| PARTIAL → RECEIVED | (입하 처리 시 자동) | 전 품목 입고 완료 | MAT_ARRIVALS 처리 시 자동 변경 |
| RECEIVED/PARTIAL → CLOSED | `PATCH /material/purchase-orders/:id/close` | 현재 상태 `RECEIVED` 또는 `PARTIAL` | 수동 마감 |
| DRAFT → (삭제) | `DELETE /material/purchase-orders/:id` | DRAFT + 입하 이력 없음 | 입하 존재 시 400 오류 |

> CONFIRMED 이후 상태는 화면 UI에서 직접 되돌릴 수 없습니다. 상태 복원이 필요하면 DB 직접 수정 또는 API 호출이 필요합니다.

## PO 번호 채번 규칙

- 서비스: `NumberingService.nextPoNo()`
- 형식: `PO-YYYYMMDD-NNN` (예: `PO-20260621-001`)
- API: `GET /material/purchase-orders/next-no` — 등록 패널 열 때 자동 호출됨.
- PO No.는 `PURCHASE_ORDERS` 테이블의 PK(`PO_NO`)이므로 중복 등록 시 409 ConflictException 반환.

## 품목 수정 동작 (수정 저장 시)

수정 저장 시 품목(PURCHASE_ORDER_ITEMS)은 **기존 전체 삭제 → 재삽입** 방식으로 처리됩니다(트랜잭션 보호). `SEQ`는 새로 발급(0-based index + 1). `RECEIVED_QTY`도 이 과정에서 초기화될 수 있으므로, 입하가 일부 진행된 PO는 품목 수정을 지양합니다.

## 총금액 계산

총금액(`TOTAL_AMOUNT`)은 저장 시점에 서비스 레이어에서 다음과 같이 계산됩니다.

```
TOTAL_AMOUNT = Σ (ORDER_QTY × UNIT_PRICE)
```

`UNIT_PRICE`가 null이면 0으로 처리됩니다. 총금액은 저장 후 `PURCHASE_ORDERS.TOTAL_AMOUNT`에 기록되며 실시간 재계산은 하지 않습니다.

## 사전 설정 (마스터·공통코드)

- 공통코드 `PO_STATUS`: DRAFT / CONFIRMED / PARTIAL / RECEIVED / CLOSED 각 코드의 `attr1`(CSS 클래스)로 목록 배지 색상 제어
- 거래처 마스터(`PARTNER_MASTERS`): `partnerType='SUPPLIER'` 유형만 선택 가능
- 품목 마스터(`ITEM_MASTERS`): `itemType='RAW_MATERIAL'` 유형만 품목 추가 모달에서 검색 가능

## 운영 절차

1. **PO 등록**: 거래처 선택 → 발주일/납기일 설정 → 품목 추가(다중 선택 가능) → 발주수량 입력 → 저장(DRAFT)
2. **발주 확정**: DRAFT PO에서 확정 액션 → CONFIRMED (입하 가능 상태)
3. **입하 연계**: 입하관리 화면에서 PO 번호 기준으로 입고 처리 → RECEIVED_QTY 갱신 → 상태 자동 전이
4. **마감**: 모든 입고 완료 후 수동 마감(CLOSED)

## 권한

- **등록·수정·삭제**: 자재관리 담당자 (DRAFT 상태만)
- **확정·마감**: 자재관리 담당자 또는 구매 승인자
- **조회**: 전 사용자

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| PO 저장 시 "이미 존재하는 PO 번호" 오류(409) | `PO_NO` 중복 | 자동 채번된 번호 그대로 사용하거나, 다른 번호로 변경 |
| 발주수량 0 또는 소수점 입력 시 저장 차단 | `ORDER_QTY` 검증 (1 이상 정수) | 1 이상 정수로 수정 후 저장 |
| PO 삭제 불가 "입하가 진행된 PO" 오류 | `MAT_ARRIVALS`에 해당 `PO_NO` 입하 이력 존재 | 입하 이력을 먼저 취소/삭제한 뒤 PO 삭제 |
| PO 삭제 불가 "DRAFT 상태만 삭제 가능" 오류 | `STATUS != 'DRAFT'` | DB 직접 조작 또는 운영 절차로 상태 복원 |
| 총금액이 0으로 표시 | `UNIT_PRICE` 미입력 | 품목 단가 등록(API or DB 직접) |
| 목록에서 품목명·규격이 보이지 않음 | `ITEM_MASTERS`에 해당 `ITEM_CODE` 미존재 | 품목마스터에 해당 품목 등록 확인 |
| 수정 후 입고수량(RECEIVED_QTY)이 0으로 초기화됨 | 수정 저장 시 품목 전체 삭제·재삽입 동작 | 입하가 진행된 PO는 품목 수정 금지; 필요 시 DB 직접 보정 |

## 데이터·연계

- 테이블: `PURCHASE_ORDERS`, `PURCHASE_ORDER_ITEMS`
- 연계: `PARTNER_MASTERS`(공급업체), `ITEM_MASTERS`(품목), `MAT_ARRIVALS`(입하 처리)
- API 경로: `GET|POST /material/purchase-orders`, `GET|PUT|DELETE /material/purchase-orders/:id`, `PATCH /material/purchase-orders/:id/confirm`, `PATCH /material/purchase-orders/:id/close`
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'` (모든 조회·저장에 자동 적용)
