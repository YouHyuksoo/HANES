---
menuCode: MAT_REQUEST
audience: operator
title: 출고요청관리 — 운영 가이드
summary: 자재 출고요청(MAT_ISSUE_REQUESTS) 생성·승인·반려·실출고 연계 로직, DB 구조, 상태 전이, 권한·트러블슈팅 설명
tags: [자재, 출고요청, 운영, BOM]
keywords: [MAT_ISSUE_REQUESTS, MAT_ISSUE_REQUEST_ITEMS, REQUEST_NO, ORDER_NO, ISSUE_TYPE, REQUESTED, APPROVED, REJECTED, COMPLETED, bomReqQty, BOM_REQ_QTY, prevIssueQty, PREV_ISSUE_QTY, floorStockQty, FLOOR_STOCK_QTY, RAW_MATERIAL, 출고요청, 승인, 반려, 실출고, 생산투입, 시작품, 샘플]
related: [MAT_ISSUE, MST_PART]
---

# 출고요청관리 — 운영 가이드

## 시스템 목적·역할

생산 현장이 창고에 원자재를 **요청**하고, 창고 담당자가 **승인·반려** 후 실출고(`MAT_ISSUES`)를 연결하는 승인 워크플로우 화면입니다. 요청-승인-출고의 3단계 흐름을 DB로 추적하여 재고 정확성과 불출 책임을 확보합니다.

```
출고요청 등록(REQUESTED)
  ↓ 승인(PATCH /approve)          → APPROVED
  ↓ 반려(PATCH /reject)           → REJECTED
      ↓ 실출고(POST /:requestNo/issue) → COMPLETED
```

멀티테넌시 스코프: `COMPANY='40'`, `PLANT_CD='1000'`이 모든 쿼리에 적용됩니다.

---

## 데이터 구조

```
MAT_ISSUE_REQUESTS (헤더, 1건 = 1 출고요청)
  └─ MAT_ISSUE_REQUEST_ITEMS (품목, N건)
         ↓ 실출고 처리 시
     MAT_ISSUES / MAT_ISSUE_ITEMS (실출고 기록)
```

- **MAT_ISSUE_REQUESTS** — 출고요청 헤더. 자연키 `REQUEST_NO` PK.
- **MAT_ISSUE_REQUEST_ITEMS** — 출고요청 품목 상세. `REQUEST_ID + SEQ` 복합 PK.
- 실출고는 별도 `MAT_ISSUES` 테이블에 기록되며 `MatStock` 재고에 반영됩니다.

---

## ① 출고요청 헤더 — MAT_ISSUE_REQUESTS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| **요청번호(requestNo)** | `REQUEST_NO VARCHAR2(50) PK` | 출고요청 자연키. 채번 방식은 서비스 레이어에서 결정. |
| **작업지시번호(orderNo)** | `ORDER_NO VARCHAR2(50)` | 연결된 작업지시 번호. NULL 허용(수동 출고요청). `PRODUCTION_JOB_ORDERS`와 논리적 연계. |
| **요청일시(requestDate)** | `REQUEST_DATE TIMESTAMP` | 요청이 등록된 시각. 기본값 `CURRENT_TIMESTAMP`. |
| **상태(status)** | `STATUS VARCHAR2(20)` | 기본값 `REQUESTED`. 허용값: `REQUESTED / APPROVED / REJECTED / COMPLETED`. |
| **요청자(requester)** | `REQUESTER VARCHAR2(100)` | 출고를 요청한 사용자 식별자. NOT NULL. |
| **승인자(approver)** | `APPROVER VARCHAR2(100)` | 승인 처리한 사용자. 승인 시점에 기록. NULL 허용. |
| **승인일시(approvedAt)** | `APPROVED_AT TIMESTAMP` | 승인 처리 시각. NULL 허용. |
| **반려사유(rejectReason)** | `REJECT_REASON VARCHAR2(500)` | 반려 시 입력한 사유. NULL 허용. |
| **출고계정(issueType)** | `ISSUE_TYPE VARCHAR2(20)` | 공통코드 `ISSUE_TYPE` 기준 출고 계정 구분. NULL 허용. 실출고 시 `MAT_ISSUES.ISSUE_TYPE`으로 전달됨. |
| **비고(remark)** | `REMARK VARCHAR2(500)` | 요청사유/메모(생산투입·시작품·샘플·기타 등). NULL 허용. |
| 멀티테넌시 | `COMPANY VARCHAR2(50)` | 회사 식별자. 기본값 `'40'`. 모든 조회·등록에 강제 적용. |
| 멀티테넌시 | `PLANT_CD VARCHAR2(50)` | 공장 식별자. 기본값 `'1000'`. 모든 조회·등록에 강제 적용. |
| 감사 | `CREATED_BY VARCHAR2(50)` | 생성 사용자 ID. NULL 허용. |
| 감사 | `UPDATED_BY VARCHAR2(50)` | 최종 수정 사용자 ID. NULL 허용. |
| 감사 | `CREATED_AT TIMESTAMP` | TypeORM `@CreateDateColumn`. 자동 기록. |
| 감사 | `UPDATED_AT TIMESTAMP` | TypeORM `@UpdateDateColumn`. 자동 기록. |

인덱스: `ORDER_NO`, `STATUS`, `REQUEST_DATE` 각각 단일 인덱스.

---

## ② 출고요청 품목 — MAT_ISSUE_REQUEST_ITEMS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| — | `REQUEST_ID VARCHAR2(50) PK` | 헤더 `REQUEST_NO` 참조값(복합PK 1/2). 헤더와 동일한 값. |
| — | `SEQ INT PK` | 품목 순번(복합PK 2/2). 1부터 순차 부여. |
| **품목코드(itemCode)** | `ITEM_CODE VARCHAR2(50)` | 출고 요청 품목. `ITEM_MASTERS` FK. 인덱스 있음. |
| **요청수량(requestQty)** | `REQUEST_QTY INT` | 창고에 요청한 수량. 1 이상 정수. NOT NULL. |
| **출고수량(issuedQty)** | `ISSUED_QTY INT DEFAULT 0` | 실출고 처리 시 누적되는 값. 실출고 완료 시 requestQty와 동일. |
| **단위(unit)** | `UNIT VARCHAR2(20)` | 수량 단위(EA, M, KG 등). NOT NULL. |
| **BOM필요(bomReqQty)** | `BOM_REQ_QTY NUMBER(12,3)` | 작업지시 계획수량 × BOM 단위소요량으로 산출. NULL 허용(수동 추가 품목은 NULL 가능). |
| **기불출(prevIssueQty)** | `PREV_ISSUE_QTY NUMBER(12,3)` | 동일 작업지시에서 이전 출고요청으로 이미 불출된 누계 수량. NULL 허용. |
| **현장재고(floorStockQty)** | `FLOOR_STOCK_QTY NUMBER(12,3)` | 현장(공정 라인) 보유 수량. 요청 시점 스냅샷. NULL 허용. |
| **비고(remark)** | `REMARK VARCHAR2(500)` | 품목별 메모. NULL 허용. |
| 멀티테넌시 | `COMPANY VARCHAR2(50)` | 헤더와 동일 스코프 적용. |
| 멀티테넌시 | `PLANT_CD VARCHAR2(50)` | 헤더와 동일 스코프 적용. |
| 감사 | `CREATED_BY`, `UPDATED_BY` | 변경 추적용. NULL 허용. |
| 감사 | `CREATED_AT`, `UPDATED_AT` | TypeORM 자동 관리. |

---

## 상태 전이 로직

### 상태별 의미

| 상태 | 전이 API | 설명 |
|------|------|------|
| `REQUESTED` | (초기값) | 요청 등록 직후. 창고 담당자 검토 대기. |
| `APPROVED` | `PATCH /:requestNo/approve` | 담당자 승인 완료. 실출고 처리 가능 상태. |
| `REJECTED` | `PATCH /:requestNo/reject` | 요청 반려. `REJECT_REASON` 기록. 재요청 가능. |
| `COMPLETED` | `POST /:requestNo/issue` | 실출고 처리 완료. `MAT_ISSUES` 레코드 생성됨. |

### 전이 가능 경로

```
REQUESTED → APPROVED  (승인)
REQUESTED → REJECTED  (반려)
APPROVED  → COMPLETED (실출고 완료)
```

> `COMPLETED` 및 `REJECTED` 상태에서는 추가 상태 전이 불가. 반려된 요청을 재활용하지 않고 신규 등록한다.

---

## BOM 기준 소요량 산출 로직

API: `GET /material/issue-requests/job-orders/:orderNo/bom-items`

백엔드 `IssueRequestService.buildBomRequestItems(orderNo, company, plant)` 가 수행하는 계산:

1. 작업지시(`orderNo`) 조회 → 계획수량(`planQty`) 확인.
2. 해당 작업지시 품목의 BOM 조회 → 단위소요량(BOM quantity).
3. `bomReqQty = planQty × 단위소요량` 산출.
4. 동일 작업지시 기존 출고요청의 `ISSUED_QTY` 합산 → `prevIssueQty`.
5. 현장재고(`floorStockQty`) 조회.
6. 현재고(`currentStock`) 조회 (`MatStock` 기준).
7. 결과를 원자재(RAW_MATERIAL) 품목 단위로 반환.

> 품목검색(`/master/parts?itemType=RAW_MATERIAL`)도 원자재만 대상으로 제한됩니다.

---

## API 경로 목록

| 메서드 | 경로 | 설명 |
|------|------|------|
| `POST` | `/material/issue-requests` | 출고요청 생성 (상태: REQUESTED 고정) |
| `GET` | `/material/issue-requests` | 목록 조회 (페이지네이션, 상태·검색어·orderNo 필터) |
| `GET` | `/material/issue-requests/:requestNo` | 상세 조회 (품목 포함) |
| `GET` | `/material/issue-requests/job-orders/:orderNo/bom-items` | 작업지시 BOM 기준 소요량 산출 |
| `PATCH` | `/material/issue-requests/:requestNo/approve` | 승인 |
| `PATCH` | `/material/issue-requests/:requestNo/reject` | 반려 (body: `reason`) |
| `POST` | `/material/issue-requests/:requestNo/issue` | 실출고 처리 (APPROVED → COMPLETED) |

---

## 사전 설정 (마스터·공통코드)

| 설정 항목 | 위치 | 영향 |
|------|------|------|
| 품목마스터(itemType=RAW_MATERIAL) | `ITEM_MASTERS` | 출고요청 품목 검색 대상 |
| BOM 등록 | `MAT_BOM` (또는 동등 테이블) | BOM 기준 소요량 계산 기준 |
| 공통코드 `JOB_ORDER_STATUS` | `COM_CODES` | 좌측 작업지시 상태 필터 셀렉트 |
| 공통코드 `ISSUE_TYPE` | `COM_CODES` | 출고계정 필드 코드 풀이 |
| 창고 마스터 | `WAREHOUSE_MASTERS` | 실출고 시 창고 선택 기준 |

---

## 운영 절차

### 신규 출고요청 등록
1. 작업지시를 선택하거나 수동 출고요청 모달을 사용해 품목·수량 입력.
2. `POST /material/issue-requests` 호출 → `REQUEST_NO` 채번, `STATUS='REQUESTED'` 저장.

### 출고요청 승인
1. 자재출고관리(MAT_ISSUE) 화면에서 REQUESTED 건 확인.
2. 검토 후 `PATCH /material/issue-requests/:requestNo/approve` 호출.
3. `STATUS='APPROVED'`, `APPROVER`, `APPROVED_AT` 기록.

### 반려 처리
1. 사유 확인 후 `PATCH /material/issue-requests/:requestNo/reject` (body: `reason`).
2. `STATUS='REJECTED'`, `REJECT_REASON` 저장. 요청자는 재요청 필요.

### 실출고 처리
1. 승인(APPROVED) 건에 대해 `POST /material/issue-requests/:requestNo/issue` 호출.
2. `MAT_ISSUES`, `MAT_ISSUE_ITEMS` 레코드 생성 → `MatStock` 재고 차감.
3. 해당 요청 `STATUS='COMPLETED'`, 품목별 `ISSUED_QTY` 업데이트.

---

## 권한

| 역할 | 가능한 작업 |
|------|------|
| 생산/현장 담당자 | 출고요청 등록, 본인 요청 조회 |
| 창고 담당자 | 출고요청 조회, 승인, 반려, 실출고 처리 |
| 관리자 | 모든 작업 |

> 현재 코드 기준 API는 별도 역할 체크 없이 테넌트 스코프(`COMPANY`, `PLANT_CD`)만 강제 적용됩니다. 역할 권한이 필요하면 `@Guard` 설정을 추가해야 합니다.

---

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| BOM 기준 품목이 0건으로 나옴 | 작업지시 BOM 미등록 또는 계획수량이 0 | BOM 등록 여부 및 작업지시 계획수량 확인 |
| 품목 검색 결과가 없음 | 품목 유형이 RAW_MATERIAL이 아님 | 품목마스터에서 itemType 확인 |
| 요청 등록 후 상태가 바뀌지 않음 | 승인 처리가 아직 안 된 것(정상 REQUESTED 상태) | 자재출고관리 화면에서 승인 처리 |
| 승인했는데 재고가 줄지 않음 | 승인은 허가 상태. 실출고 처리 미완 | `POST /:requestNo/issue` 실출고 API 호출 필요 |
| APPROVED 상태에서 다시 반려하고 싶음 | APPROVED → REJECTED 전이는 코드상 정의되어 있지 않음 | 해당 요청을 COMPLETED 처리하지 않고 신규 요청으로 대체하거나 DB 직접 처리 필요 (운영자 판단) |
| `ISSUED_QTY`가 `REQUEST_QTY`보다 적음 | 부분 출고 상태. COMPLETED가 아닐 수 있음 | 잔여수량 확인 후 추가 실출고 처리 |
| 출고요청 목록 조회가 느림 | STATUS / ORDER_NO / REQUEST_DATE 인덱스 있음. 데이터 누적 시 페이지네이션 확인 | page/limit 파라미터 확인, 필터 활용 권장 |

---

## 데이터·연계

- **헤더 테이블**: `MAT_ISSUE_REQUESTS` — `COMPANY='40'`, `PLANT_CD='1000'` 스코프 고정.
- **품목 테이블**: `MAT_ISSUE_REQUEST_ITEMS` — 동일 스코프.
- **실출고 연계**: 실출고 처리 시 `MAT_ISSUES` + `MAT_ISSUE_ITEMS` 생성, `MatStock` 차감.
- **작업지시 연계**: `PRODUCTION_JOB_ORDERS.ORDER_NO` 논리 연계 (외래키 제약 없음, 서비스 레이어에서 검증).
- **품목마스터 연계**: `ITEM_MASTERS.ITEM_CODE` 논리 연계.
- **연계 화면**: 자재출고관리(MAT_ISSUE) — 승인·실출고 처리 진행.
