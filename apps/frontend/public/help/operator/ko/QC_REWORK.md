---
menuCode: QC_REWORK
audience: operator
title: 재작업 지시 관리 — 운영 가이드
summary: IATF 16949 재작업 지시 전과정 관리 — 등록·QC승인·생산승인·공정실행·완료, DefectLog 연동, 격리/재고 처리
tags: [품질, 재작업, IATF16949, 승인, 공정]
keywords: [REWORK_ORDERS, REWORK_PROCESSES, REWORK_RESULTS, DEFECT_LOG, REGISTERED, QC_PENDING, PROD_PENDING, APPROVED, IN_PROGRESS, INSPECT_PENDING, 재작업, 재작업지시, QC승인, 생산승인, 공정관리]
related: [QC_REWORK_INSPECT, QC_DEFECT]
---

# 재작업 지시 관리 — 운영 가이드

## 시스템 목적·역할
IATF 16949 요구사항에 따른 **재작업(Rework) 지시**를 등록부터 완료까지 전과정 관리하는 화면입니다. 불량이력(DefectLog)에서 재작업 대상을 등록하고, QC·생산 승인을 거쳐 공정을 실행한 후 재검사 대기 상태로 전이합니다.

```
DefectLog → REGISTERED → QC_PENDING → PROD_PENDING → APPROVED → IN_PROGRESS → INSPECT_PENDING
               ↑              ↓              ↓
          QC_REJECTED    PROD_REJECTED
```

## 데이터 구조
```
REWORK_ORDERS (PK: REWORK_NO, 포맷: RW-YYYYMMDD-NNN)
   ├─ DEFECT_LOG_ID → DefectLog (occurAt|seq)
   ├─ ITEM_CODE / REWORK_QTY / REWORK_METHOD / STATUS
   ├─ QC_APPROVER / PROD_APPROVER (이중 승인)
   └─ ISOLATION_FLAG (격리: 1 / 정상: 0)

REWORK_PROCESSES (PK: REWORK_NO + PROCESS_CODE)
   └─ STATUS: WAITING → IN_PROGRESS → COMPLETED / SKIPPED

REWORK_RESULTS (PK: REWORK_NO + PROCESS_CODE + SEQ)
   └─ workerId / goodQty / defectQty / workDetail / workTimeMin

REWORK_INSPECTS (PK: REWORK_NO + SEQ)
   └─ 재검사 결과 (PASS/FAIL/SCRAP)
```

## 화면 구성

### 메인 영역
- **헤더**: 제목 + 새로고침·재작업등록 버튼
- **StatCard (5개)**: 전체·승인대기·진행중·완료·재검사대기
- **툴바**: 검색어·기간·상태·라인 필터
- **DataGrid**: `GET /quality/reworks`
  - 컬럼: 액션·재작업번호·품목코드·품목명·수량·불량유형·상태·작업자·생성일
  - 행 선택 → 우측 패널

### 우측 패널 (3가지)
| 패널 | 호출 조건 | 기능 |
|------|-----------|------|
| ReworkFormPanel | 등록/수정 | 재작업 지시 생성 또는 수정 (REGISTERED/QUE_REJECTED/PROD_REJECTED만) |
| ReworkApprovePanel | 승인 | QC 승인 또는 생산 승인 (APPROVE/REJECT + 사유) |
| ReworkResultPanel | 실적입력 | 공정별 작업 실적 등록 |

## 작업 흐름

### ① 재작업 등록
`POST /quality/reworks { defectLogId, itemCode, reworkQty, reworkMethod, processItems, ... }`
- DefectLog 연결 시 자동으로 `DEFECT_LOG.status = 'REWORK'`
- `isolationFlag = 1` (격리 설정)
- 공정 목록(`processItems`) 포함 가능 (라우팅 기준 자동 생성 가능)

### ② 승인 요청
`PATCH /quality/reworks/{id}/request-approval`
- REGISTERED → QC_PENDING

### ③ QC 승인
`PATCH /quality/reworks/{id}/qc-approve { action: APPROVE|REJECT, reason }`
- 승인 시: QC_PENDING → PROD_PENDING
- 반려 시: QC_PENDING → QC_REJECTED (사유 필수)

### ④ 생산 승인
`PATCH /quality/reworks/{id}/prod-approve { action: APPROVE|REJECT, reason }`
- 승인 시: PROD_PENDING → APPROVED
- 반려 시: PROD_PENDING → PROD_REJECTED (사유 필수)

### ⑤ 작업 시작
`PATCH /quality/reworks/{id}/start`
- APPROVED → IN_PROGRESS

### ⑥ 공정 실행
`PATCH /quality/reworks/processes/{orderId}/{processCode}/start`
`PATCH /quality/reworks/processes/{orderId}/{processCode}/complete { resultQty }`
`PATCH /quality/reworks/processes/{orderId}/{processCode}/skip`
- 개별 공정별 작업자·실적·시간 입력
- 공정 실적: `POST /quality/reworks/results { workerId, resultQty, goodQty, defectQty, workDetail, workTimeMin }`

### ⑦ 작업 완료
`PATCH /quality/reworks/{id}/complete { resultQty }`
- 모든 공정 COMPLETED/SKIPPED 시 자동으로 INSPECT_PENDING 전환
- 이후 재작업검사(`/quality/rework-inspect`)에서 최종 PASS/FAIL/SCRAP 판정

## 상태 코드 (REWORK_STATUS)

| 코드 | 의미 | 실행 가능 작업 |
|------|------|---------------|
| REGISTERED | 등록 | 수정·삭제·승인요청 |
| QC_PENDING | QC 승인대기 | QC승인/반려 |
| QC_REJECTED | QC 반려 | 수정·재요청 |
| PROD_PENDING | 생산 승인대기 | 생산승인/반려 |
| PROD_REJECTED | 생산 반려 | 수정·재요청 |
| APPROVED | 승인완료 | 작업시작 |
| IN_PROGRESS | 작업중 | 공정실행·작업완료 |
| INSPECT_PENDING | 재검사대기 | 재검사 |
| PASS | 합격 | |
| FAIL | 불합격 | |
| SCRAP | 폐기 | |

## 주요 규칙

| 규칙 | 설명 |
|------|------|
| 재작업번호 | `RW-YYYYMMDD-NNN` 자동채번 |
| 승인체계 | QC → 생산 순차 이중승인 |
| DefectLog 연동 | 등록 시 `→ REWORK`, PASS `→ DONE`, SCRAP `→ SCRAP` |
| 격리 | 등록/FAIL 시 `isolationFlag=1`, PASS 시 `=0` |
| 재고 | PASS: DEFECT→WIP_MAIN, SCRAP: DEFECT→SCRAP, FAIL: DEFECT 잔류 |
| 삭제 제한 | REGISTERED만 가능, 공정/검사 있으면 차단 |

## 문제 해결

| 증상 | 원인 | 조치 |
|------|------|------|
| 등록 불가 | 필수값 누락 | 품목·수량·재작업방법 확인 |
| 승인 버튼 안 보임 | 상태 불일치 | 현재 상태 확인 |
| 작업시작 불가 | 승인 미완료 | QC+생산 승인 완료 확인 |
| 공정 없음 | processItems 미포함 | 공정 추가 후 재시도 |

## 데이터·연계
- 테이블: `REWORK_ORDERS`, `REWORK_PROCESSES`, `REWORK_RESULTS`, `REWORK_INSPECTS`, `DEFECT_LOGS`
- 연계: 불량관리(`/quality/defect`) → **재작업지시(현재)** → 재작업검사(`/quality/rework-inspect`)
- 재고: `ProductInventoryService` (DEFECT→WIP_MAIN/SCRAP)
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
