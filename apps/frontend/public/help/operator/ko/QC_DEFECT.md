---
menuCode: QC_DEFECT
audience: operator
title: 불량관리 — 운영 가이드
summary: 불량이력 조회·등록·상태 변경 — 제품 바코드/작업지시 스캔, 불량코드·등급·범위 자동 표시, WAIT→REPAIR/REWORK/SCRAP/DONE 상태 전이
tags: [품질, 불량, 불량관리, 불량이력]
keywords: [DEFECT_LOGS, DEFECT_CODE_MASTERS, DEFECT_CATEGORY_MASTERS, WAIT, REPAIR, REWORK, SCRAP, DONE, CRITICAL, MAJOR, MINOR, 불량관리, 불량이력, 불량코드, 불량등급]
related: [QC_DEFECT_CODE, QC_REWORK_INSPECT]
---

# 불량관리 — 운영 가이드

## 시스템 목적·역할
생산 과정에서 발생한 불량을 **등록·조회·상태 관리**하는 화면입니다. 제품 바코드(PROD_RESULT) 또는 FG 바코드를 스캔하여 불량을 등록하고, WAIT→REPAIR/REWORK/SCRAP/DONE으로 상태를 전이합니다. 불량코드는 3단계 카테고리 체계로 관리되며, 등급(CRITICAL/MAJOR/MINOR)과 범위가 자동 표시됩니다.

```
불량발생 → 등록(WAIT) → 수리(REPAIR) → 완료(DONE)
                       → 재작업(REWORK) → 완료(DONE)
                       → 폐기(SCRAP)
```

## 데이터 구조
```
DEFECT_LOGS (PK: OCCUR_TIME + SEQ, ID: "occurAtISO|seq")
   ├─ PROD_RESULT_ID → PROD_RESULTS (생산실적)
   ├─ DEFECT_CODE → DEFECT_CODE_MASTERS
   ├─ QTY / STATUS / CAUSE
   └─ STATUS: WAIT → REPAIR / REWORK / SCRAP → DONE

DEFECT_CODE_MASTERS (PK: COMPANY + PLANT_CD + DEFECT_CODE)
   3단계 카테고리 체계 + 등급(CRITICAL/MAJOR/MINOR) + 범위

REPAIR_LOGS (PK: REPAIR_DATE + SEQ)
   수리이력 (수리자·작업내용·사용자재·소요시간·결과)
```

## 화면 구성

### 메인 영역
- **헤더**: 제목 + 새로고침·불량등록 버튼
- **툴바 필터**:
  - 검색어 (제품바코드·작업지시번호)
  - 기간 (DateRangeFilter)
  - 불량유형 Select (`GET /quality/defect-codes/options?defectScope=PRODUCT`)
  - 상태 Select (`DEFECT_LOG_STATUS` 공통코드)
- **DataGrid**: `GET /quality/defect-logs?limit=5000`
  - 컬럼: 액션·발생시간·작업지시번호·불량코드·불량명·수량·상태·작업자·원인
  - 행 클릭 → 우측 패널 열기

### 우측 패널 (DefectFormPanel, 480px)
`POST /quality/defect-logs`

| 항목 | 설명 |
|------|------|
| 제품 바코드 | PROD_RESULT.prdUid 또는 FG_LABELS.fgBarcode 스캔 (자동포커스) |
| 작업지시 번호 | 작업지시 번호 수동 입력 (바코드 대체용) |
| 불량유형 | 불량코드 선택 (PRODUCT 범위) |
| 불량등급 | 자동 표시: 🔴 CRITICAL / 🟠 MAJOR / 🟡 MINOR |
| 불량범위 | 자동 표시: RAW_MATERIAL / PRODUCT / PROCESS / COMMON |
| 수량 | 기본 1 |
| 원인 | 불량 원인 텍스트 |
- 저장 조건: `prdUid` 또는 `workOrderNo` 둘 중 하나 필수

### 상태 변경 모달
`PATCH /quality/defect-logs/{id}/status { status }`

| 현재 상태 | 전이 가능 상태 |
|-----------|---------------|
| WAIT | REPAIR, REWORK, SCRAP |
| REPAIR | DONE, SCRAP, WAIT |
| REWORK | DONE, SCRAP, WAIT |
| SCRAP | (종단) |
| DONE | (종단) |

## 상태 코드 (DEFECT_LOG_STATUS)

| 코드 | 의미 | 다음 상태 |
|------|------|-----------|
| WAIT | 불량 접수 (초기) | REPAIR / REWORK / SCRAP |
| REPAIR | 수리 진행 중 | DONE / SCRAP / WAIT |
| REWORK | 재작업 진행 중 | DONE / SCRAP / WAIT |
| SCRAP | 폐기 처리 (종단) | - |
| DONE | 처리 완료 (종단) | - |

## 불량 등급

| 등급 | 색상 | 의미 |
|------|------|------|
| CRITICAL | 🔴 Red | 치명적 불량 |
| MAJOR | 🟠 Orange | 중대 불량 |
| MINOR | 🟡 Yellow | 경미 불량 |

## 인터록

| 조건 | 설명 |
|------|------|
| 바코드·작업지시 모두 미입력 | 등록 불가 |
| 불량코드 미선택 | 등록 불가 |
| SCRAP/DONE은 상태 변경 불가 | 종단 상태 |
| 재작업 연결 시 직접 수정/삭제 불가 | ReworkOrder 연결 시 제한 |

## 문제 해결

| 증상 | 원인 | 조치 |
|------|------|------|
| 바코드 인식 안 됨 | PROD_RESULT 또는 FG_LABELS 미존재 | 작업지시 번호로 대체 입력 |
| 불량코드 목록 없음 | PRODUCT 범위 코드 미등록 | 불량코드마스터에서 등록 |
| 상태 변경 안 됨 | 종단 상태(SCRAP/DONE) | 변경 불가 상태 |
| 수정 안 됨 | 재작업 연결됨 | 재작업검사에서 간접 처리 |

## 데이터·연계
- 테이블: `DEFECT_LOGS`, `DEFECT_CODE_MASTERS`, `DEFECT_CATEGORY_MASTERS`, `DEFECT_CODE_PRODUCT_TYPES`, `REPAIR_LOGS`, `PROD_RESULTS`, `FG_LABELS`, `REWORK_ORDERS`
- 연계: 생산실적 적산 → **불량등록(현재)** → 수리/재작업/폐기 → 재작업검사
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
