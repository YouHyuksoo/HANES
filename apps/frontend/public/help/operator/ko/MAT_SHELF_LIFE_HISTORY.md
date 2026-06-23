---
menuCode: MAT_SHELF_LIFE_HISTORY
audience: operator
title: 유수명자재 검사이력 — 운영 가이드
summary: 유수명자재 재검사 이력 조회 — 검사일·LOT·품목·회차·PASS/FAIL 결과·측정항목 상세
tags: [자재, 유수명, 재검사, 이력, 조회]
keywords: [SHELF_LIFE, HISTORY, REINSPECT, IQC_LOGS, RETEST, PASS, FAIL, retestRound, inspectDate, 유수명자재, 검사이력, 재검사이력]
related: [MAT_SHELF_LIFE, MAT_SHELF_LIFE_REINSPECT]
---

# 유수명자재 검사이력 — 운영 가이드

## 시스템 목적·역할
유수명자재 재검사(`RETEST`) 이력을 조회하는 읽기 전용 화면입니다. 재검사 시점의 검사일·LOT·품목·회차·PASS/FAIL 결과와 측정항목 상세를 확인할 수 있습니다.

```
IQC_LOGS (inspectType='RETEST') → 검사이력 목록 → 행 선택 → 측정항목 상세 모달
```

## 데이터 구조
```
IQC_LOGS (PK: inspectDate + seq, inspectType='RETEST' 고정)
   ├─ matUid → MAT_LOTS (LOT)
   ├─ itemCode → PART_MASTERS (품목)
   ├─ retestRound (재검회차, 자동증가)
   ├─ result (PASS / FAIL)
   ├─ inspectorName / destructSampleQty
   ├─ details (CLOB) — 측정항목 JSON
   │   └─ [{ inspectItem, spec, lsl, usl, unit, measuredValue, judge }]
   └─ remark
```

## 화면 구성
- **헤더**: 제목 + 새로고침 버튼
- **툴바**:
  - 검색어 입력 (`LOT·품목 검색...` — `matUid`·`itemCode`·`itemName`·`inspectorName` 클라이언트 필터)
  - 품목 선택 (`PartSelect` 컴포넌트, 정확일치)
  - 결과 필터 (`전체`/`합격(PASS)`/`불합격(FAIL)`, 서버 API 재조회)
- **DataGrid**: `GET /material/shelf-life/reinspect?limit=2000`

| 컬럼 | 설명 |
|------|------|
| 작업 | Eye 버튼 → 측정항목 상세 모달 |
| 검사일 | `inspectDate` |
| LOT No. | `matUid` (고정폭) |
| 품목코드 | `itemCode` (고정폭) |
| 품목명 | `itemName` (서버 JOIN) |
| 재검회차 | `retestRound` (1, 2, 3...) |
| 결과 | `result` (PASS=합격/FAIL=불합격 badge) |
| 검사자 | `inspectorName` |
| 비고 | `remark` |

### 측정항목 상세 모달
- **헤더 정보**: 품목명 · LOT No. · 회차 · 결과(badge) · 검사자 · 시료수량 · 비고
- **항목 테이블**:

| 컬럼 | 설명 |
|------|------|
| # | 순번 |
| 검사항목 | `inspectItem` |
| 규격 | `spec` |
| 하한(LSL) | `lsl` |
| 상한(USL) | `usl` |
| 측정값 | `measuredValue` |
| 판정 | PASS(CheckCircle) / FAIL(XCircle) |

※ details가 없거나 빈 배열이면 `"항목별 측정값 없음 (수동 판정)"` 표시

## 작업 흐름

### ① 이력 조회
- `GET /material/shelf-life/reinspect` — `inspectType='RETEST'` 전체 이력
- 결과 필터(PASS/FAIL) → 서버 API 재조회
- 검색어/품목 → 클라이언트 필터링

### ② 측정항목 상세 확인
- 행 우측 Eye 버튼 클릭
- `details` JSON 파싱하여 검사항목별 측정값·판정 표시
- PASS/FAIL 사유 확인 가능

## 주요 규칙

| 규칙 | 설명 |
|------|------|
| 읽기 전용 | 조회만 가능 (수정/삭제/생성 불가) |
| RETEST 전용 | `inspectType='RETEST'`만 표시 (INITIAL 제외) |
| 측정항목 자동판정 | LSL/USL 기준 자동 PASS/FAIL (수동판정 시 details=null) |

## 데이터·연계
- 테이블: `IQC_LOGS`, `MAT_LOTS`, `PART_MASTERS`
- 연계: 유수명자재만료현황(`/material/shelf-life`) → 재검사(`/material/shelf-life-reinspect`) → **재검사이력(현재)**
- IQC 이력(`/material/iqc-history`)과 별개 — RETEST 전용 화면
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
