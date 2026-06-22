---
menuCode: MAT_ISSUE
audience: operator
title: 자재출고관리(양산) — 운영 가이드
summary: 양산 자재 출고요청 승인·처리 및 바코드 스캔 출고의 DB 구조, 재고차감 로직, 상태 전이, 취소·역분개 메커니즘과 트러블슈팅
tags: [자재, 출고, 양산, 운영, 재고차감]
keywords: [자재출고, 양산출고, MAT_ISSUES, MAT_ISSUE_REQUESTS, MAT_ISSUE_REQUEST_ITEMS, MAT_STOCKS, STOCK_TRANSACTIONS, 출고계정, ISSUE_TYPE, PRODUCTION, 재고차감, 역분개, 출고취소, WIP_MAT_STOCKS, 공정이동, WIP_MOVE, MAT_OUT, 출고번호, 요청번호, matUid, 자재시리얼, IQC합격, HOLD, DEPLETED, 멀티테넌시, COMPANY, PLANT_CD]
related: [MAT_REQUEST, MAT_ISSUE_OTHER, MST_PART]
---

# 자재출고관리(양산) — 운영 가이드

## 시스템 목적·역할
양산(PRODUCTION) 계정으로 자재를 창고에서 생산현장으로 불출하는 화면입니다. 출고 확정 시 **MAT_STOCKS(원자재 재고)를 차감**하고 **MAT_ISSUES(출고 이력)** 및 **STOCK_TRANSACTIONS(재고 거래)** 레코드를 생성합니다. 작업지시에 설비가 배정된 경우 원자재 창고 차감과 동시에 **WIP_MAT_STOCKS(공정재고)에 이동 가산**합니다.

## 처리 흐름
```
출고요청 생성(MAT_ISSUE_REQUESTS: REQUESTED)
  → 승인(APPROVED)
  → 출고처리(MatIssueService.createInTx)
      → MAT_ISSUES 생성(DONE)
      → MAT_STOCKS 차감 (availableQty/qty 감소)
      → STOCK_TRANSACTIONS 기록 (MAT_OUT 또는 WIP_MOVE)
      → [설비 배정 시] WIP_MAT_STOCKS 가산
      → 잔여 재고 0이면 MAT_LOTS.status → DEPLETED
  → 전 품목 완전출고 시 요청 상태 → COMPLETED
```

---

## 데이터 구조
```
MAT_ISSUE_REQUESTS (출고요청 헤더)
  └─ MAT_ISSUE_REQUEST_ITEMS (요청 품목 상세, PK: REQUEST_ID + SEQ)

MAT_ISSUES (출고 실적, PK: ISSUE_NO + SEQ)
  ├─ MAT_LOTS (자재 LOT, matUid 참조)
  ├─ MAT_STOCKS (창고별 재고 — 차감 대상)
  └─ STOCK_TRANSACTIONS (재고 거래 이력)

MAT_STOCKS (PK: COMPANY + PLANT_CD + WAREHOUSE_CODE + ITEM_CODE + MAT_UID)
  └─ WIP_MAT_STOCKS (공정재고, 설비 단위 — 공정이동 시 가산)
```

---

## ① 출고요청 — MAT_ISSUE_REQUESTS / MAT_ISSUE_REQUEST_ITEMS (전체 컬럼)

### MAT_ISSUE_REQUESTS

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|---|---|---|
| **요청번호(requestNo)** | `REQUEST_NO` VARCHAR2(50) PK | 자연키. `MAT_REQ` 채번 시퀀스로 자동 생성(`REQ-YYYYMMDD-NNN` 형식). |
| **작업지시(workOrderNo / orderNo)** | `ORDER_NO` VARCHAR2(50) | 연결 작업지시. 있으면 BOM 기반 품목이 자동 계산되어 요청 품목으로 채워짐. |
| **요청일(requestDate)** | `REQUEST_DATE` TIMESTAMP | 요청 등록 일시. DEFAULT CURRENT_TIMESTAMP. |
| **상태(status)** | `STATUS` VARCHAR2(20) | REQUESTED → APPROVED → COMPLETED (또는 REJECTED). DEFAULT 'REQUESTED'. |
| **요청자(requester)** | `REQUESTER` VARCHAR2(100) | 출고를 요청한 담당자. 현재 SYSTEM 고정. |
| **승인자(approver)** | `APPROVER` VARCHAR2(100) | 승인 처리한 담당자. |
| **승인일시(approvedAt)** | `APPROVED_AT` TIMESTAMP | 승인 처리 일시. |
| **반려사유(rejectReason)** | `REJECT_REASON` VARCHAR2(500) | 반려 시 입력한 사유. |
| **출고계정(issueType)** | `ISSUE_TYPE` VARCHAR2(20) | 공통코드 `ISSUE_TYPE` 기준. 이 화면에서는 PRODUCTION. |
| **비고(remark)** | `REMARK` VARCHAR2(500) | 자유 기입 비고. |
| **멀티테넌시 스코프** | `COMPANY` / `PLANT_CD` | `COMPANY='40'`, `PLANT_CD='1000'`. 모든 조회·처리에 자동 적용. |

### MAT_ISSUE_REQUEST_ITEMS

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|---|---|---|
| **요청번호(requestId)** | `REQUEST_ID` VARCHAR2(50) PK | 헤더 `REQUEST_NO`를 참조하는 FK 역할. |
| **순번(seq)** | `SEQ` INT PK | 요청 내 품목 순번. PK 복합키의 일부. |
| **품목코드(itemCode)** | `ITEM_CODE` VARCHAR2(50) | 출고 요청 품목. 원자재(RAW)만 포함, 제품·소모품(MRO)은 제외. |
| **요청수량(requestQty)** | `REQUEST_QTY` INT | 현장에서 요청한 수량. |
| **기출고수량(issuedQty)** | `ISSUED_QTY` INT | 실제 출고된 누계 수량. DEFAULT 0. 부분 출고 시 점증. |
| **단위(unit)** | `UNIT` VARCHAR2(20) | 수량 단위. |
| **BOM 소요량(bomReqQty)** | `BOM_REQ_QTY` NUMBER(12,3) | BOM qtyPer × 생산수량. 작업지시 기반 요청 시 자동 계산. |
| **기 불출수량(prevIssueQty)** | `PREV_ISSUE_QTY` NUMBER(12,3) | 해당 작업지시에 이미 출고된 수량. |
| **현장재고(floorStockQty)** | `FLOOR_STOCK_QTY` NUMBER(12,3) | 현장(FLOOR 타입 창고) 기준 가용 재고. |
| **비고** | `REMARK` VARCHAR2(500) | 품목별 비고. |
| **멀티테넌시** | `COMPANY` / `PLANT_CD` | 헤더와 동일 스코프. |

---

## ② 출고 실적 — MAT_ISSUES (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|---|---|---|
| **출고번호(issueNo)** | `ISSUE_NO` VARCHAR2(50) PK | `MAT_ISSUE` 채번 시퀀스. 단일 출고 트랜잭션에 복수 SEQ가 묶임. |
| **순번(seq)** | `SEQ` INT PK | 품목 행 순번. DEFAULT 1. |
| **작업지시(orderNo)** | `ORDER_NO` VARCHAR2(50) | 연결 작업지시. 없으면 NULL. |
| **생산실적번호(prodResultNo)** | `PROD_RESULT_ID` VARCHAR2(50) | 생산실적과의 연결. 취소 시 뒤 공정 진행 여부 확인에 사용. |
| **자재시리얼(matUid)** | `MAT_UID` VARCHAR2(50) | 출고된 LOT 시리얼. `MAT_LOTS.MAT_UID` 참조. |
| **출고수량(issueQty)** | `ISSUE_QTY` INT | 실제 출고된 수량. |
| **출고일(issueDate)** | `ISSUE_DATE` TIMESTAMP | 출고 처리 일시. DEFAULT CURRENT_TIMESTAMP. |
| **출고계정(issueType)** | `ISSUE_TYPE` VARCHAR2(20) | 공통코드 `ISSUE_TYPE`. DEFAULT 'PROD'. 이 화면에서는 PRODUCTION으로 생성. |
| **작업자(workerId)** | `WORKER_ID` VARCHAR2(50) | 처리 작업자 ID. |
| **불출자(issuerId / issuerName)** | `ISSUER_ID` / `ISSUER_NAME` | 자재를 실제 불출한 담당자 사번·이름(바코드 스캔 지원 예정). |
| **수령인(receiverId / receiverName)** | `RECEIVER_ID` / `RECEIVER_NAME` | 자재를 수령한 담당자 사번·이름(바코드 스캔 지원 예정). |
| **비고(remark)** | `REMARK` VARCHAR2(500) | 출고 사유 또는 자동 생성 메시지. |
| **상태(status)** | `STATUS` VARCHAR2(20) | DONE(완료) / CANCELED(취소). DEFAULT 'DONE'. |
| **멀티테넌시** | `COMPANY` / `PLANT_CD` | `COMPANY='40'`, `PLANT_CD='1000'`. |

---

## ③ 재고 — MAT_STOCKS (출고 차감 대상)

| DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|---|---|
| `COMPANY` + `PLANT_CD` + `WAREHOUSE_CODE` + `ITEM_CODE` + `MAT_UID` | 복합 PK. 창고·품목·LOT 단위로 재고를 관리. |
| `QTY` | 총 수량. 출고 시 감소. |
| `RESERVED_QTY` | 예약(선점) 수량. |
| `AVAILABLE_QTY` | 가용 수량 (= QTY − RESERVED_QTY). 출고 시 실제 감소 기준. |
| `LOCATION_CODE` | 창고 내 위치 코드. |

> 출고 처리 시 `QTY`와 `AVAILABLE_QTY`가 동시에 차감됩니다. 복수 창고에 재고가 분산된 경우 지정 창고를 우선으로, 나머지는 창고코드 오름차순으로 순차 차감합니다.

---

## 출고 처리 로직 (재고 차감)

### 일반 출고 (단순 MAT_OUT)
1. LOT(`matUid`) 조회 → IQC 합격(PASS) · 보류 아님(not HOLD) 검증.
2. `MAT_STOCKS`에서 가용수량 조회 → 출고 요청량 충족 여부 검증.
3. `MAT_ISSUES` 행 생성(status=DONE).
4. `MAT_STOCKS.QTY` 및 `AVAILABLE_QTY` 차감.
5. `STOCK_TRANSACTIONS` 기록 (`transType='MAT_OUT'`, `qty=−출고량`).
6. 차감 후 LOT 전체 잔여 재고 = 0이면 `MAT_LOTS.status → 'DEPLETED'`.

### 공정이동 출고 (작업지시 + 설비 배정 시, WIP_MOVE)
- 위 1~5 과정과 동일하게 MAT_STOCKS 차감.
- 추가로 `WIP_MAT_STOCKS`(공정재고)에 동량 **가산** (`transType='WIP_MOVE'`, `transType='WIP_IN'`).
- 생산실적 입력 시 공정재고에서 소비됩니다.

### 바코드 스캔 출고 (scan)
- `POST /material/issues/scan` 호출. `{ matUid, issueType }` 전달.
- LOT의 가용 재고 **전량**을 일괄 출고. 수량 조정 불가.
- 내부적으로 위 일반 출고 로직을 재사용.

---

## 출고 취소 로직 (역분개)

1. `MAT_ISSUES.status → 'CANCELED'` 업데이트.
2. 원본 `STOCK_TRANSACTIONS` 조회 (refType='MAT_ISSUE', refId='issueNo-seq').
3. 각 원본 거래에 대해 **역분개 거래** 생성:
   - 단순출고(MAT_OUT) → `MAT_OUT_CANCEL` 거래 + `MAT_STOCKS` 복원(가산).
   - 공정이동(WIP_MOVE) → `WIP_MOVE_CANCEL` 거래 + `MAT_STOCKS` 복원 + `WIP_MAT_STOCKS` 차감 복원(`WIP_IN_CANCEL`).
4. `MAT_LOTS.status → 'NORMAL'` 복원(DEPLETED였으면 해제).

> **취소 불가 조건**: 해당 출고의 뒤 공정(생산실적 RUNNING/DONE, FG 라벨)이 존재하면 취소가 차단됩니다. 출하 → 팔레트 → 박스/OQC → FG 라벨 → 생산실적 순서로 역처리 후 다시 시도하세요.

---

## 출고요청 상태 전이

```
REQUESTED  → (승인) →  APPROVED
           → (반려) →  REJECTED

APPROVED   → (전 품목 완전 출고) →  COMPLETED
           → (부분 출고)         →  APPROVED (유지)
```

- `REQUESTED` 상태에서만 승인·반려 가능.
- `APPROVED` 상태에서만 출고처리 가능.
- 잔여 수량이 남아 있으면 부분 출고 후에도 `APPROVED` 상태 유지.

---

## 출고 가능 조건 (운영자 확인 포인트)

LOT를 출고하려면 **모두 충족**해야 합니다:

- `MAT_LOTS.iqcStatus = 'PASS'` (IQC 합격)
- `MAT_LOTS.status != 'HOLD'` (보류 아님)
- `MAT_STOCKS.availableQty >= 출고 요청량` (재고 충분)
- `MAT_LOTS.status != 'DEPLETED'` (이미 소진되지 않음, 스캔 출고 시)
- 출고요청 기반 출고 시: `MAT_ISSUE_REQUESTS.status = 'APPROVED'`
- 출고요청 기반 출고 시: LOT 품목코드 = 요청 품목코드 일치

---

## 사전 설정 (마스터·공통코드)

| 설정 항목 | 위치 | 내용 |
|---|---|---|
| 품목마스터 | `MST_PART` | itemType이 원자재 계열이어야 출고요청 품목으로 포함 |
| 공통코드 ISSUE_TYPE | 공통코드 관리 | PRODUCTION, MANUAL, SCRAP 등 출고 유형 정의 |
| 창고 마스터 | 창고 관리 | 원자재 창고 · FLOOR 타입 창고 등록 |
| BOM 마스터 | `MST_BOM` | 작업지시 기반 자동 품목 산출에 사용 |
| 작업지시 · 설비 배정 | `PRD_JOB_ORDERS` | 설비 배정 여부가 MAT_OUT vs WIP_MOVE 분기 결정 |

---

## 운영 절차

1. 현장에서 출고요청 등록 → `MAT_ISSUE_REQUESTS` 생성(REQUESTED).
2. 창고/관리자가 **출고요청처리** 탭에서 요청 검토 후 승인 또는 반려.
3. 승인 후 **출고처리** 버튼으로 LOT 선택 · 수량 확인 · 출고 실행.
4. 부분 출고 가능 — 잔여 수량이 남으면 APPROVED 유지, 추가 출고 가능.
5. 긴급 출고는 **바코드스캔** 탭에서 LOT 바코드 스캔 → 전량 즉시 출고.
6. 오출고 시 **출고이력** 탭에서 해당 건을 찾아 취소 처리(사유 입력 필수).

---

## 권한

| 역할 | 가능 작업 |
|---|---|
| 창고 담당자 | 출고처리(바코드스캔), 이력 조회 |
| 관리자 / 자재 담당자 | 출고요청 승인·반려·출고처리, 취소, 이력 조회 |
| 일반 사용자 | 이력 조회만 가능 |

---

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|---|---|---|
| 출고처리 모달에서 LOT 목록이 비어 있음 | 해당 품목에 IQC 합격 + 가용수량 > 0 재고 없음 | 자재 입고 현황 및 IQC 결과 확인 |
| 바코드 스캔 시 "IQC 미합격" 오류 | `MAT_LOTS.iqcStatus != 'PASS'` | IQC 담당자에게 검사 완료 요청 |
| 바코드 스캔 시 "보류 LOT" 오류 | `MAT_LOTS.status = 'HOLD'` | 보류 해제 후 출고 |
| 바코드 스캔 시 "이미 소진된 LOT" 오류 | `MAT_LOTS.status = 'DEPLETED'` 또는 가용수량 = 0 | 다른 LOT 사용 또는 재고 조정 확인 |
| "LOT 재고 부족" 오류 | `MAT_STOCKS.availableQty < issueQty` | 재고 현황 조회 후 수량 재확인 |
| 출고 취소가 차단됨 | 뒤 공정(생산실적 RUNNING/DONE, FG라벨) 존재 | 출하 → 팔레트 → 박스/OQC → FG라벨 → 생산실적 순서로 역처리 후 재시도 |
| "이미 취소된 출고" 오류 | `MAT_ISSUES.status = 'CANCELED'` | 이미 취소 처리된 건. 중복 요청 방지 |
| 품목코드 불일치 오류 | 선택한 LOT의 품목코드와 요청 품목코드가 다름 | 올바른 LOT 선택 또는 요청 품목 재확인 |
| 승인 후 출고 불가 | `MAT_ISSUE_REQUESTS.status != 'APPROVED'` | 상태 확인; REQUESTED면 승인 먼저 진행 |

---

## 데이터·연계

| 항목 | 내용 |
|---|---|
| **핵심 테이블** | `MAT_ISSUES`, `MAT_ISSUE_REQUESTS`, `MAT_ISSUE_REQUEST_ITEMS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS` |
| **연계 테이블** | `MAT_LOTS`(LOT 정보), `PART_MASTERS`(품목명·단위), `JOB_ORDERS`(작업지시·설비), `WIP_MAT_STOCKS`(공정재고), `MAT_LOTS.status`(DEPLETED 자동 설정) |
| **연계 화면** | 출고요청관리(MAT_REQUEST), 기타출고관리(MAT_ISSUE_OTHER), 자재재고현황(MAT_STOCK), 생산실적 |
| **API** | `GET /material/issue-requests`, `PATCH /material/issue-requests/:id/approve·reject`, `POST /material/issue-requests/:id/issue`, `POST /material/issues/scan`, `GET /material/issues`, `POST /material/issues/:no/:seq/cancel` |
| **멀티테넌시 스코프** | `COMPANY='40'`, `PLANT_CD='1000'` — 모든 조회·생성·취소에 자동 적용 |
