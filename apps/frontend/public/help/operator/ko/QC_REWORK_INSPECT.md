---
menuCode: QC_REWORK_INSPECT
audience: operator
title: 재작업검사 — 운영 가이드
summary: IATF 16949 재작업 완료 건 재검증 검사 — 재검사대기 목록 조회·PASS/FAIL/SCRAP 판정·수량 입력·재고 자동 전환
tags: [품질, 재작업, 재검사, IATF16949]
keywords: [REWORK_ORDERS, REWORK_INSPECTS, INSPECT_PENDING, INSPECT_METHOD, PASS, FAIL, SCRAP, DEFECT_LOG, 재작업검사, 재검사, 재작업, 불량처리]
related: [QC_INSPECT, INSP_RESULT]
---

# 재작업검사 — 운영 가이드

## 시스템 목적·역할
IATF 16949 요구사항에 따라 **재작업(Rework) 완료 건에 대한 재검증 검사**를 수행하는 화면입니다. 재작업 완료 후 `INSPECT_PENDING` 상태의 오더 목록을 조회하고, PASS/FAIL/SCRAP을 판정하여 검사 실적을 등록합니다. 검사 결과에 따라 **재고가 자동 전환**되며, 연결된 불량이력(DefectLog) 상태도 함께 갱신됩니다.

```
불량발생 → DefectLog → ReworkOrder(REGISTERED) → 승인 → 재작업 → INSPECT_PENDING
    → 검사(PASS/FAIL/SCRAP) → 재고전환 + DefectLog 상태 갱신
```

## 상태 흐름 (REWORK_ORDERS)
```
REGISTERED → QC_PENDING → PROD_PENDING → APPROVED
    → IN_PROGRESS → INSPECT_PENDING → PASS / FAIL / SCRAP
```

## 데이터 구조
```
REWORK_ORDERS (PK: REWORK_NO, 포맷: RW-YYYYMMDD-NNN)
   ├─ DEFECT_LOG_ID → DefectLog (불량이력 연결)
   ├─ ITEM_CODE → PartMaster
   ├─ REWORK_QTY / RESULT_QTY / PASS_QTY / FAIL_QTY
   └─ STATUS: INSPECT_PENDING (검사대기)

REWORK_INSPECTS (PK: REWORK_ORDER_ID + SEQ)
   검사 실적 (SEQ는 오더 내 자동 증가)
```

## 화면 구성

### 메인 영역
- **헤더**: 제목 + 새로고침 버튼
- **StatCard (3개)**:
  - 🔵 재검사대기 건수 (목록 count)
  - 🟢 합격 건수 (PASS 통계)
  - 🔴 불합격 건수 (FAIL 통계)
- **DataGrid**: `GET /quality/reworks?status=INSPECT_PENDING&limit=5000`
  - 컬럼: 재작업번호·품목코드·품목명·재작업수량·실적수량·작업자·완료시간·상태
  - 상태는 `REWORK_STATUS` 공통코드 뱃지 표시
  - 검색: 재작업번호·품목코드·품목명 (300ms 디바운스)
  - 행 우측 `FileSearch` 아이콘 클릭 → 우측 패널 열기

### 우측 패널 (480px, InspectFormPanel)
`POST /quality/reworks/inspects`

| 항목 | 컴포넌트 | 설명 |
|------|----------|------|
| 대상 요약 | 카드 | 재작업번호·품목코드·재작업수량·실적수량 표시 |
| 검사자 | `WorkerSelect` | 필수. 미선택 시 등록 버튼 비활성화 |
| 검사방법 | `ComCodeSelect` | 공통코드 `INSPECT_METHOD` |
| 검사결과 | 라디오 버튼 3개 | PASS / FAIL / SCRAP (초기값: PASS) |
| 합격수량 | `QtyInput` | PASS 시 양품수량 (초기값: resultQty) |
| 불량수량 | `QtyInput` | FAIL/SCRAP 시 불량수량 |
| 불량상세 | textarea | FAIL/SCRAP 사유 |
| 비고 | `Input` | |

## 검사 흐름

### ① 재검사대기 목록 확인
`GET /quality/reworks?status=INSPECT_PENDING`
- 재작업 공정(`REWORK_PROCESSES`)이 모두 완료되면 자동으로 `INSPECT_PENDING`으로 전이
- 검색으로 원하는 오더 필터링

### ② 검사 정보 입력
- 검사자 선택 (필수)
- 검사방법 선택 (예: 전수검사, 샘플링 등)
- 검사결과 선택: **PASS** / **FAIL** / **SCRAP**
  - **PASS**: 양품으로 판정 → 재고 `DEFECT` 창고 → `WIP_MAIN` 창고 이전
  - **FAIL**: 재작업 불량 → `DEFECT` 창고 잔류 (재재작 가능)
  - **SCRAP**: 폐품 처리 → `DEFECT` 창고 → `SCRAP` 창고 이전

### ③ 검사 등록 (POST /quality/reworks/inspects)
서버 측 처리 순서:
1. 상태 검증: `INSPECT_PENDING`이 아니면 `BadRequestException`
2. SEQ 자동 채번: 오더 내 기존 검사 수 + 1
3. REWORK_ORDERS 상태/수량 갱신:
   - `status` = 검사결과 (PASS/FAIL/SCRAP)
   - `passQty`, `failQty` 갱신
   - `isolationFlag`: PASS=0(격리해제), FAIL/SCRAP=1(격리유지)
4. DefectLog 상태 동기화 (연결된 경우):
   - PASS → `DONE`, SCRAP → `SCRAP`, FAIL → `REWORK` (유지)
5. 재고 처리 (FAIL 제외):
   - PASS: passQty → DEFECT→WIP_MAIN 양품복원 (부족 시 보충입고 자동 생성)
   - SCRAP: failQty → DEFECT→SCRAP 폐품처리
   - FAIL: 재고 이동 없음, DEFECT 창고 잔류

## 인터록 (등록 차단 조건)

| 조건 | 메시지 | 해결 |
|------|--------|------|
| 검사자 미선택 | 검사자를 선택하세요 | WorkerSelect에서 검사자 선택 |
| 상태가 INSPECT_PENDING 아님 | 재검사대기 상태가 아닙니다 | 재작업 공정 완료 확인 |

## 재작업 상태 코드 (REWORK_STATUS)

| 코드 | 의미 | 비고 |
|------|------|------|
| REGISTERED | 등록 | DefectLog에서 최초 생성 |
| QC_PENDING | QC 승인대기 | |
| PROD_PENDING | 생산 승인대기 | |
| APPROVED | 승인완료 | QC+생산 승인 |
| IN_PROGRESS | 재작업 진행중 | 공정별 작업 |
| INSPECT_PENDING | 재검사대기 | **이 화면에서 조회되는 상태** |
| PASS | 합격 | 재고 양품 복원 |
| FAIL | 불합격 | 재재작 필요 |
| SCRAP | 폐기 | 폐품 처리 |

## 전체 컬럼 — REWORK_ORDERS

| 항목 | DB 컬럼 | 역할 |
|------|---------|------|
| 재작업번호 | `REWORK_NO` | PK. 포맷 `RW-YYYYMMDD-NNN` |
| 불량이력ID | `DEFECT_LOG_ID` | 연결된 DefectLog (occurAt\|seq) |
| 품목코드 | `ITEM_CODE` | FK → PartMaster |
| 품목명 | `ITEM_NAME` | |
| 재작업수량 | `REWORK_QTY` | 총 재작업 대상 수량 |
| 실적수량 | `RESULT_QTY` | 실제 재작업 완료 수량 |
| 상태 | `STATUS` | `REWORK_STATUS` 공통코드 |
| 재작업방법 | `REWORK_METHOD` | IATF: 승인된 재작업 방법 |
| 격리여부 | `ISOLATION_FLAG` | 1=격리, 0=해제 |
| 합격수량 | `PASS_QTY` | 검사에서 설정 |
| 불량수량 | `FAIL_QTY` | 검사에서 설정 |
| 작업자 | `WORKER_CODE` | |
| 라인 | `LINE_CODE` | FK → ProdLineMaster |
| 설비 | `EQUIP_CODE` | FK → EquipMaster |
| 시작 | `START_AT` | |
| 완료 | `END_AT` | |
| 비고 | `REMARK` | |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | `40` / `1000` |

## 전체 컬럼 — REWORK_INSPECTS

| 항목 | DB 컬럼 | 역할 |
|------|---------|------|
| 재작업번호 | `REWORK_ORDER_ID` | PK (FK → REWORK_ORDERS) |
| 일련번호 | `SEQ` | PK (오더 내 자동 증가) |
| 검사자 | `INSPECTOR_CODE` | |
| 검사시간 | `INSPECT_AT` | |
| 검사방법 | `INSPECT_METHOD` | 공통코드 `INSPECT_METHOD` |
| 검사결과 | `INSPECT_RESULT` | PASS / FAIL / SCRAP |
| 합격수량 | `PASS_QTY` | |
| 불량수량 | `FAIL_QTY` | |
| 불량상세 | `DEFECT_DETAIL` | 최대 1000자 |
| 비고 | `REMARK` | |

## 사전 설정 (마스터·공통코드)
- 공통코드: `REWORK_STATUS`(재작업 상태), `INSPECT_METHOD`(검사방법)
- 재작업 오더: ReworkOrder가 `INSPECT_PENDING` 상태로 존재해야 목록 조회됨
- 재고: DEFECT/WIP_MAIN/SCRAP 창고 코드 사전 등록 필요
- 권한: 품질검사자(검사 등록), 관리자(이력 수정)

## DefectLog 연동 규칙
- 재작업과 연결된 DefectLog는 직접 삭제/수정 불가
- 검사 등록 시 자동 동기화되므로 별도 DefectLog 처리 불필요
- DefectLog 삭제 시 `재작업이 연결된 불량은 직접 처리할 수 없습니다` 오류

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| 목록이 비어 있음 | `INSPECT_PENDING` 상태 오더 없음 | 재작업 공정 완료 확인 |
| 등록 버튼 비활성화 | 검사자 미선택 | WorkerSelect에서 검사자 선택 |
| "재검사대기 상태가 아닙니다" 오류 | 상태가 INSPECT_PENDING 아님 | 새로고침 후 재시도 |
| SCRAP 후 재고 부족 오류 | DEFECT 창고 재고 부족 | 재고 확인 후 수량 조정 |
| DefectLog 변경 불가 | ReworkOrder 연결됨 | 검사 등록으로 간접 처리 |
| 재작업번호 포맷 오류 | `RW-YYYYMMDD-NNN` 규칙 위반 | 자동 채번 사용 |

## 데이터·연계
- 테이블: `REWORK_ORDERS`, `REWORK_INSPECTS`, `REWORK_PROCESSES`, `REWORK_RESULTS`, `DEFECT_LOGS`, `PartMaster`
- 연계: DefectLog 불량이력 → 재작업 등록 → 재작업 공정 → **재작업검사(현재화면)** → 재고전환
- 재작업번호 채번: `RW-YYYYMMDD-NNN` 포맷 (서버 자동 생성)
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
