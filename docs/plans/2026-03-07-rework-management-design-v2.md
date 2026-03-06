# 재작업관리 설계 문서 v2

> IATF 16949 8.7.1 "부적합 출력물의 관리" 준수
> 작성일: 2026-03-07 | v2: 공정 라우팅 연동 + 실적 분리

## 1. 개요

v1 대비 변경점:
- 재작업 지시 시 품목의 **공정 라우팅(ProcessMap)에서 재작업할 공정을 선별 선택**
- 재작업 실적을 **공정별로 별도 기록** (ReworkResult)
- 흐름: 지시등록(공정선택) → 승인 → 공정별 실적입력 → 전체완료 → 재검사

## 2. 엔티티 구조 (변경)

### 관계도
```
ReworkOrder (마스터)
  ├── ReworkProcess[] (공정별 작업지시)
  │     └── ReworkResult[] (공정별 실적)
  └── ReworkInspect[] (재검사)
```

### 2.1 ReworkProcess (신규 — 공정별 작업지시)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | number (SEQ) | PK |
| reworkOrderId | number | ReworkOrder FK |
| processCode | string | 공정코드 (ProcessMaster 참조) |
| processName | string | 공정명 |
| seq | number | 공정순서 (ProcessMap.seq) |
| status | string | WAITING / IN_PROGRESS / COMPLETED / SKIPPED |
| workerCode | string? | 배정 작업자 |
| lineCode | string? | 배정 라인 |
| equipCode | string? | 배정 설비 |
| planQty | number | 계획 수량 |
| resultQty | number | 결과 수량 |
| startAt | timestamp? | 시작일시 |
| endAt | timestamp? | 종료일시 |
| remarks | string? | 비고 |
| company, plant, createdBy, updatedBy, createdAt, updatedAt | | 공통 |

### 2.2 ReworkResult (신규 — 공정별 실적 기록)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | number (SEQ) | PK |
| reworkProcessId | number | ReworkProcess FK |
| workerCode | string | 실제 작업자 |
| resultQty | number | 작업 수량 |
| goodQty | number | 양품 수량 |
| defectQty | number | 불량 수량 |
| workDetail | string | 작업내역 (IATF: 처리 결과 기록) |
| workTimeMin | number? | 작업시간 (분) |
| startAt | timestamp? | 시작 |
| endAt | timestamp? | 종료 |
| remarks | string? | 비고 |
| company, plant, createdBy, updatedBy, createdAt, updatedAt | | 공통 |

### 2.3 ReworkOrder 변경점
- resultQty, passQty, failQty → 집계값 (ReworkProcess에서 계산)
- 상태 흐름은 동일하되, IN_PROGRESS → INSPECT_PENDING 전환은 **전체 공정 완료 시 자동**

## 3. 상태 흐름 (v2)

### ReworkOrder 상태
```
REGISTERED → QC_PENDING → QC_APPROVED/QC_REJECTED
  → PROD_PENDING → APPROVED/PROD_REJECTED
    → IN_PROGRESS (첫 공정 시작 시 자동)
      → INSPECT_PENDING (전체 공정 완료 시 자동)
        → PASS / FAIL / SCRAP (재검사 결과)
```

### ReworkProcess 상태
```
WAITING → IN_PROGRESS → COMPLETED
                      → SKIPPED (건너뛰기)
```

## 4. API 변경

### 추가 엔드포인트
| Method | Path | 설명 |
|--------|------|------|
| GET | /quality/reworks/:id/processes | 공정 목록 조회 |
| PATCH | /quality/rework-processes/:id/start | 공정 작업시작 |
| PATCH | /quality/rework-processes/:id/complete | 공정 작업완료 |
| PATCH | /quality/rework-processes/:id/skip | 공정 건너뛰기 |
| GET | /quality/rework-processes/:id/results | 공정별 실적 조회 |
| POST | /quality/rework-results | 실적 등록 |

### 변경 엔드포인트
| Method | Path | 변경 내용 |
|--------|------|-----------|
| POST | /quality/reworks | body에 processItems[] 추가 |
| GET | /quality/reworks/:id | relations에 processes 포함 |

## 5. 프론트엔드 변경

### 재작업 지시 등록 패널 (ReworkFormPanel)
- 품목 선택 → GET /master/routings?itemCode=XXX → 라우팅 목록 표시
- 체크박스로 재작업할 공정 선별 선택
- 각 공정별 작업자/라인/설비 배정 가능

### 재작업 지시 상세 (행 클릭 시)
- 하위 공정 목록 표시 (sub-grid 또는 패널)
- 공정별 상태, 실적 확인

### 재작업 실적 입력 (별도 관리)
- IN_PROGRESS 상태의 공정 목록 표시
- 공정 선택 → 실적 입력 패널 (작업자, 수량, 작업내역, 시간)
- 공정 완료 시 전체 공정 완료 여부 체크 → 자동 INSPECT_PENDING 전환

## 6. 워크플로우 (전체)
```
1. 재작업 지시 등록
   - 품목 선택 → 라우팅 조회
   - 재작업할 공정 체크 (예: 압착, 검사만)
   - 공정별 작업자/설비 배정
2. 승인요청 → 품질승인 → 생산승인
3. 공정별 작업
   - 공정1: 시작 → 실적입력 → 완료
   - 공정2: 시작 → 실적입력 → 완료
   - (전체 공정 완료 → 자동 INSPECT_PENDING)
4. 재검사
   - 검사자가 재검증 → PASS/FAIL/SCRAP
5. 완료
```
