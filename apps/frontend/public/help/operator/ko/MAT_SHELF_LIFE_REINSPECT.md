---
menuCode: MAT_SHELF_LIFE_REINSPECT
audience: operator
title: 유수명자재 재검사 — 운영 가이드
summary: 유통기한 임박/만료 LOT 재검사 — IQC 검사항목 측정·PASS/FAIL 판정·연장일 설정·FAIL 시 자동 격리/폐기
tags: [자재, 유수명, 재검사, IQC, LOT, 유통기한]
keywords: [SHELF_LIFE, REINSPECT, MAT_LOTS, IQC_LOGS, RETEST, EXPIRED, NEAR_EXPIRY, VALID, DISCARDED, expireDate, extendDays, 유수명자재, 재검사, 유통기한, LOT연장]
related: [MAT_SHELF_LIFE, MAT_SHELF_LIFE_HISTORY, QC_IQC]
---

# 유수명자재 재검사 — 운영 가이드

## 시스템 목적·역할
유통기한이 임박(`NEAR_EXPIRY`) 또는 만료(`EXPIRED`)된 자재 LOT를 재검사하여 연장 또는 폐기 처리하는 화면입니다. IQC 검사항목(IQC_PART_SPEC)을 기준으로 측정값을 입력하고 PASS/FAIL을 판정합니다. PASS 시 유통기한을 연장하고, FAIL 시 해당 LOT를 자동으로 DEFECT 창고로 격리·폐기 처리합니다.

```
대상 LOT 목록 → IQC 검사항목 측정 → PASS: 만료일 연장 / FAIL: DEFECT 격리+DISCARDED
```

## 데이터 구조
```
MAT_LOTS (PK: matUid)
   ├─ itemCode → ITEM_MASTERS (expiryExtDays: 최대연장일)
   ├─ expireDate (유통기한)
   └─ status: NORMAL / DISCARDED

IQC_LOGS (inspectType='RETEST')
   ├─ matUid / retestRound (회차 자동증가)
   ├─ result (PASS/FAIL) / extendDays
   └─ details (측정항목 JSON)
```

## 화면 구성

### 메인 영역
- **헤더**: 제목 + 링크(유수명자재만료현황·재검사이력)
- **DataGrid**: `GET /material/shelf-life?limit=5000`
  - 클라이언트 필터: `EXPIRED` + `NEAR_EXPIRY`만 표시
  - 컬럼: 액션·LOT No.·품목코드·품목명·현재수량·만료일·잔여일수·만료상태
  - 검색: LOT번호·품목코드·품목명, 만료상태 필터
  - 행 우측 `검사` 버튼 → ReinspectModal 열기
  - URL `?matUid=XXX`로 자동 오픈 지원

### 재검사 모달 (ReinspectModal)
| 영역 | 설명 |
|------|------|
| 대상 정보 | LOT·품목·수량·현재만료일·잔여일수 |
| IQC 검사항목 | `GET /master/iqc-part-specs/{itemCode}/resolve-items` |
| 측정값 입력 | LSL/USL 있는 항목 → 숫자 입력 (자동 PASS/FAIL 판정) |
| | LSL/USL 없는 항목 → PASS/FAIL 토글 |
| 종합판정 | 전체 PASS → 상단 자동 PASS / 하나라도 FAIL → FAIL |
| 검사자 | 선택 입력 |
| 시료수량 | 파괴검사 시 소모된 수량 |
| 적용연장일 | PASS 시 연장할 일수 (빈값 → expiryExtDays 최대치) |
| 비고 | |

## 재검사 흐름

### ① 대상 LOT 선택
`GET /material/shelf-life?limit=5000`
- EXPIRED(만료) + NEAR_EXPIRY(임박) LOT만 표시
- 유수명자재 만료현황 페이지(`/material/shelf-life`)에서 `재검사` 링크로도 진입 가능

### ② IQC 검사항목 로드
`GET /master/iqc-part-specs/{itemCode}/resolve-items`
- 해당 품목에 등록된 IQC 검사항목 조회
- LSL(하한)/USL(상한) 기준으로 측정값 자동 판정

### ③ 측정값 입력
- 숫자 항목: 실제 측정값 입력 → LSL/USL 범위 내면 PASS
- 토글 항목: PASS/FAIL 직접 선택

### ④ 재검사 제출
`POST /material/shelf-life/reinspect { matUid, result, inspectorName, extendDays, destructSampleQty, details, remark }`

| 결과 | 처리 |
|------|------|
| **PASS** | `MatLot.expireDate` = 검사일 + `extendDays` (최대 `expiryExtDays`) |
| **FAIL** | 양품재고 → DEFECT 창고 이전, `MatLot.status = 'DISCARDED'` |

## 만료상태 기준

| 상태 | 조건 |
|------|------|
| EXPIRED | `expireDate < 오늘` |
| NEAR_EXPIRY | `expireDate <= 오늘 + nearExpiryDays(기본 10일)` |
| VALID | 그 외 |
| DISCARDED | `MatLot.status = 'DISCARDED'` |

## 인터록

| 조건 | 설명 |
|------|------|
| 이미 DISCARDED | 재검사 불가 |
| 연장일 > expiryExtDays | 최대 연장일 초과 시 제한 |
| FAIL 시 예약수량 존재 | DEFECT 이동 불가 (선처리 필요) |

## 문제 해결

| 증상 | 원인 | 조치 |
|------|------|------|
| 대상 LOT 없음 | EXPIRED/NEAR_EXPIRY 없음 | 유수명자재현황 확인 |
| IQC 항목 없음 | 품목별 IQC 항목 미등록 | IQC_PART_SPEC 등록 필요 |
| 연장 불가 | expiryExtDays=0 | 품목마스터 최대연장일 확인 |
| FAIL 시 오류 | DEFECT 창고 코드 없음 | WAREHOUSES DEFECT 등록 확인 |

## 데이터·연계
- 테이블: `MAT_LOTS`, `IQC_LOGS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS`, `ITEM_MASTERS`
- 연계: 유수명자재만료현황(`/material/shelf-life`) → **재검사(현재)** → 재검사이력(`/material/shelf-life-history`)
- IQC: `IQC_PART_SPEC` 기준 검사항목 사용
- 공통코드: `EXPIRY_STATUS` (EXPIRED/NEAR_EXPIRY/VALID/DISCARDED)
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
