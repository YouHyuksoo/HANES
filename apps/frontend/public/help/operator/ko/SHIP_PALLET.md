---
menuCode: SHIP_PALLET
audience: operator
title: 팔레트적재 — 운영 가이드
summary: 출하 팔레트 관리 — 팔레트 생성·박스 할당/제거·CLOSE/REOPEN·라벨 출력·OQC PASS 박스만 적재 가능
tags: [출하, 팔레트, 적재, 박스, 라벨]
keywords: [PALLET_MASTERS, BOX_MASTERS, SHIPMENT_ORDERS, OPEN, CLOSED, LOADED, SHIPPED, PALLET_STATUS, OQC_STATUS, 팔레트, 팔레트적재, 박스할당, 라벨출력]
related: [SHIP_PACK, SHIP_ORDER]
---

# 팔레트적재 — 운영 가이드

## 시스템 목적·역할
출하 팔레트를 생성하고 박스를 할당·관리하는 화면입니다. CONFIRMED 상태의 출하지시를 기준으로 팔레트를 생성하고, CLOSED+OQC PASS 박스를 스캔/선택하여 적재합니다. 팔레트 CLOSE 후 라벨을 출력하고 출하 대기합니다.

```
CONFIRMED 출하지시 → 팔레트 생성(OPEN) → 박스 할당 → CLOSE → 라벨출력 → LOADED → SHIPPED
```

## 상태 흐름 (팔레트)
```
OPEN → CLOSED(라벨출력완료) → LOADED(선적할당) → SHIPPED(출하완료)
CLOSED → OPEN (재오픈 가능)
```

## 데이터 구조
```
PALLET_MASTERS (PK: PALLET_NO)
   ├─ SHIP_ORDER_NO → SHIPMENT_ORDERS
   ├─ BOX_COUNT / TOTAL_QTY (자동계산)
   ├─ STATUS: OPEN → CLOSED → LOADED → SHIPPED
   └─ CLOSE_TIME / SHIPPED_TIME / SHIPMENT_ID

BOX_MASTERS (PK: BOX_NO + COMPANY + PLANT_CD)
   ├─ ITEM_CODE → ITEM_MASTERS
   ├─ PALLET_NO → PALLET_MASTERS
   ├─ STATUS: OPEN → CLOSED → SHIPPED
   └─ OQC_STATUS: PENDING / PASS / FAIL
```

## 화면 구성

### 상단
- **헤더**: 제목 + 새로고침·팔레트 생성 버튼
- **좌측(2/3)**: DataGrid — 팔레트 목록
  - 컬럼: 액션·출하지시번호·팔레트번호·박스수·총수량·상태·출하번호·생성일시
  - 액션: 박스할당(OPEN)·CLOSE(OPEN)·재오픈(CLOSED)·라벨출력(CLOSED+)
  - 검색: 팔레트번호, 바코드 스캔 입력, 상태 필터
  - 상태 헤더 `HelpCircle` → 상태 전이 설명 툴팁
- **우측(1/3)**: 선택 팔레트 상세
  - 팔레트 요약 정보
  - 할당된 박스 목록 (OPEN 시 박스 제거 가능)
  - 박스정보: 박스번호·품목코드·수량·OQC 상태

### 생성 모달
- 출하지시 스캔/선택 → 팔레트 생성
- CONFIRMED 상태의 출하지시만 선택 가능

### 박스할당 모달
- `+` 버튼 또는 박스번호 스캔
- 할당 가능 박스: `CLOSED` + `unassigned=true` + `oqcStatus=PASS`
- OQC PASS되지 않은 박스는 할당 불가

### 라벨 모달 (PalletLabelModal)
- Code128 바코드 (bwip-js)
- 박스수·총수량·상태·품목명
- 템플릿 선택 가능 (master/label-templates)
- 자동출력 모드 지원
- 용지: 100mm × 120mm

## 작업 흐름

### ① 팔레트 생성
`POST /shipping/orders/{shipOrderNo}/pallets`
- CONFIRMED 출하지시 선택 (스캔 또는 목록 선택)
- 출하지시당 팔레트 1개만 생성 가능

### ② 박스 할당
`POST /shipping/orders/{shipOrderNo}/pallets/{palletNo}/boxes`
- 박스 스캔 또는 목록에서 선택
- 다중 박스 선택 가능
- OQC PASS + CLOSED + 미할당 박스만 가능

### ③ 팔레트 CLOSE
`POST /shipping/orders/{shipOrderNo}/pallets/{palletNo}/close`
- OPEN → CLOSED 전환
- CLOSE 후 라벨 출력 가능

### ④ 팔레트 재오픈
`POST /shipping/pallets/{palletNo}/reopen`
- CLOSED → OPEN 전환
- 박스 재할당/제거 목적

### ⑤ 라벨 출력
- CLOSED+ 상태에서 라벨 모달 열기
- bwip-js Code128 바코드 생성
- 템플릿 선택·인쇄

## 박스 할당 조건

| 조건 | 설명 |
|------|------|
| BOX_MASTERS.STATUS = CLOSED | 박스가 포장 완료 상태 |
| OQC_STATUS = PASS | OQC 검사 합격 |
| PALLET_NO = NULL | 다른 팔레트에 할당되지 않은 박스 |
| 동일 출하지시 범위 | 해당 출하지시 품목만 할당 |

## 인터록

| 조건 | 설명 |
|------|------|
| OQC FAIL 박스 | 할당 불가 |
| 이미 할당된 박스 | 중복 할당 불가 |
| CONFIRMED 아닌 출하지시 | 팔레트 생성 불가 |
| SHIPPED/LOADED 팔레트 | CLOSE/재오픈 불가 |
| 출하지시당 1팔레트 | 생성 제한 |

## 문제 해결

| 증상 | 원인 | 조치 |
|------|------|------|
| 팔레트 생성 불가 | 출하지시 CONFIRMED 아님 | 출하지시 확정 필요 |
| 박스 할당 불가 | OQC PASS 아님 | 외관검사 완료 필요 |
| 박스 검색 안 됨 | 이미 할당됨 | 미할당 박스 확인 |
| CLOSE 버튼 비활성화 | 박스 0개 | 박스 할당 필요 |
| 라벨 안 나옴 | 프린터 설정 | 브라우저 인쇄 설정 확인 |

## 데이터·연계
- 테이블: `PALLET_MASTERS`, `BOX_MASTERS`, `SHIPMENT_ORDERS`, `SHIPMENT_ORDER_ITEMS`
- 연계: 출하지시(`/shipping/order`) → 제품포장(`/shipping/pack`) → **팔레트적재(현재)** → 출하
- OQC 조건: 외관검사(`/quality/inspect`) PASS 필요
- 라벨: bwip-js Code128, `master/label-templates` 디자인 시스템
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
