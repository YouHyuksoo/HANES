---
menuCode: PROD_RESULT
audience: operator
title: 생산실적 — 운영 가이드
summary: 공정별 생산실적 통합 조회·수정·취소 — CUT/CRIMP/ASSY/INSP/PACK, 작업자 아바타 표시, 실적 취소 시 재고 자동 복원
tags: [생산, 실적, 조회, 수정, 취소]
keywords: [PROD_RESULTS, JOB_ORDERS, RUNNING, DONE, CANCELED, goodQty, defectQty, cycleTime, prdUid, 생산실적, 작업실적, 실적취소, 재고복원]
related: [PROD_RESULT_SUMMARY, PROD_INPUT_KIOSK, PROD_ORDER]
---

# 생산실적 — 운영 가이드

## 시스템 목적·역할
공정(CUT/CRIMP/ASSY/INSP/PACK)별 생산실적을 통합 조회·수정·취소하는 화면입니다. 작업자 프로필 아바타를 함께 표시하며, 실적 취소 시 투입 자재와 생산 재고가 자동 복원됩니다.

```
RUNNING → DONE (완료) / CANCELED (취소 → 재고복원)
```

## 데이터 구조
```
PROD_RESULTS (PK: RESULT_NO, 자동채번)
   ├─ ORDER_NO → JOB_ORDERS (작업지시)
   ├─ EQUIP_CODE → EQUIP_MASTER (설비)
   ├─ WORKER_NO → WORKER_MASTERS (작업자)
   ├─ GOOD_QTY / DEFECT_QTY (양품/불량)
   ├─ START_TIME / END_TIME / CYCLE_TIME
   └─ STATUS: RUNNING → DONE / CANCELED
```

## 화면 구성
- **헤더**: 제목 + 새로고침 버튼
- **툴바**: 검색어(실적번호·작업지시·제품UID) + 공정필터(CUT/CRIMP/ASSY/INSP/PACK) + 기간(DateRangeFilter, 기본 오늘)
- **DataGrid**: `GET /production/prod-results?limit=5000`

| 컬럼 | 설명 |
|------|------|
| 실적번호 | `RESULT_NO` (PK) |
| 작업일 | `START_TIME` 기준 |
| 공정유형 | `PROCESS_CODE` (ComCodeBadge) |
| 작업지시 | `ORDER_NO` |
| 품목명 | `JOB_ORDERS → PART_MASTERS.ITEM_NAME` |
| 라인명 | `JOB_ORDERS.LINE_CODE` |
| 설비명 | `EQUIP_MASTER.EQUIP_NAME` |
| 작업자 | `WORKER_MASTERS` (프로필 아바타 + 이름) |
| 제품UID | `PRD_UID` (시리얼/LOT) |
| 양품 | `GOOD_QTY` (초록) |
| 불량 | `DEFECT_QTY` (빨강) |
| 불량률 | `DEFECT_QTY / (GOOD_QTY + DEFECT_QTY) × 100` |
| 작업시간 | `START_TIME ~ END_TIME` |
| 사이클타임 | `CYCLE_TIME` (초) |
| 상태 | `STATUS` (RUNNING/DONE/CANCELED) |
| 액션 | 수정·취소·삭제 |

## 작업 흐름

### ① 실적 조회
- 공정유형별 필터링 (CUT/CRIMP/ASSY/INSP/PACK)
- 기간 검색 (START_TIME 기준)
- 작업지시·실적번호·제품UID 검색

### ② 실적 수정
`PUT /production/prod-results/{resultNo} { goodQty, defectQty, remark }`
- RUNNING/DONE 상태에서 가능
- 수량 변경 시 자재 자동 역발행/재발행 + 재고 조정

### ③ 실적 취소
`POST /production/prod-results/{resultNo}/cancel { remark }`
- RUNNING/DONE → CANCELED
- 취소 시 재고 복원:
  - 자재 역발행 (WipMatStock + StockTransaction)
  - 제품 재고 역처리 (WIP_IN/FG_IN/DEFECT_IN 취소)
  - 설비 currentJobOrderId 해제
- 하류공정 진행 시 취소 불가 (FG_LABELS·BOX·PALLET·SHIPMENT)

### ④ 실적 삭제
`DELETE /production/prod-results/{resultNo}`
- CANCELED 상태만 삭제 가능

## 주요 규칙

| 규칙 | 설명 |
|------|------|
| 자재 자동차감 | 생성 시 BOM 기반 자재 차감 (ON_CREATE), 완료 시 추가 차감 (ON_COMPLETE) |
| 제품재고 즉시적재 | 양품은 WIP_MAIN, 불량은 DEFECT 창고에 즉시 적재 |
| 설비 BOM 인터록 | 설비 BOM과 작업지시 품목 불일치 시 생성 차단 |
| 작업지시 자동승격 | 첫 실적 → WAITING→RUNNING, 계획달성 → 자동 DONE |
| 교대 자동할당 | SHIFT_PATTERNS 기반 자동 할당 |
| 금형 타수 적산 | 완료 시 CONSUMABLE_MASTER.currentCount 증가 |
| SG라벨 발행 | 최초 공정실적 시 반제품 추적라벨 발행 |

## 인터록

| 조건 | 설명 |
|------|------|
| 취소 시 하류공정 있음 | FG_LABELS/BOX/PALLET/SHIPMENT 존재 시 취소 불가 |
| 이미 CANCELED | 삭제만 가능 |
| ORDER_NO 변경 | 수정 불가 (고정) |
| STATUS 직접 변경 | complete/cancel API 통해서만 가능 |

## 문제 해결

| 증상 | 원인 | 조치 |
|------|------|------|
| 실적 없음 | 해당 기간·공정에 데이터 없음 | 필터 조건 완화 |
| 취소 불가 | 포장·출하 진행됨 | 하류공정 확인 후 역순 처리 |
| 수정 불가 | CANCELED 상태 | 취소 후 재작업 |
| 생성 불가 | 설비 BOM 불일치 | 설비 BOM 확인 |

## 데이터·연계
- 테이블: `PROD_RESULTS`, `JOB_ORDERS`, `EQUIP_MASTER`, `WORKER_MASTERS`, `PART_MASTERS`, `DEFECT_LOGS`, `FG_LABELS`, `SG_LABELS`, `PRODUCT_TRANSACTIONS`, `MAT_ISSUES`, `STOCK_TRANSACTIONS`, `BOX_MASTERS`, `PALLET_MASTERS`, `SHIPMENT_LOGS`
- 연계: 작업지시(`/production/order`) → **생산실적(현재)** → 실적집계(`/production/result-summary`)
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
