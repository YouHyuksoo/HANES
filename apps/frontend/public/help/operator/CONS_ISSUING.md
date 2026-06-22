---
menuCode: CONS_ISSUING
audience: operator
title: 소모품출고 — 운영 가이드
summary: 소모품 UID 스캔 출고/출고취소의 API·DB 매핑(CONSUMABLE_STOCKS 상태전이, CONSUMABLE_LOGS 이력), 재고 가감 로직, 권한, 트러블슈팅, 멀티테넌시 스코프
tags: [소모품, 출고, 반납, 운영, 재고차감]
keywords: [소모품출고, 출고, 출고취소, 출고반품, OUT, OUT_RETURN, ISSUED, ACTIVE, conUid, CONSUMABLE_STOCKS, CONSUMABLE_LOGS, CONSUMABLE_MASTERS, STOCK_QTY, SEQ_CONSUMABLE_LOGS, issueByScan, issueReturnByScan, logTypeGroup, 멀티테넌시, COMPANY, PLANT_CD]
related: [CONS_MASTER, CONS_RECEIVING, CONS_STOCK]
---

# 소모품출고 — 운영 가이드

## 시스템 목적·역할
소모품 개별 인스턴스(`CONSUMABLE_STOCKS`)의 **UID(`CON_UID`) 단위 출고/출고취소**를 처리하는 화면입니다. 출고 시 인스턴스 상태를 `ACTIVE → ISSUED`로 전이하고, 마스터(`CONSUMABLE_MASTERS.STOCK_QTY`)를 1 차감하며, 이력(`CONSUMABLE_LOGS`)에 `OUT` 로그를 1건 남깁니다. 출고취소는 그 반대(`ISSUED → ACTIVE`, 재고 +1, `OUT_RETURN` 로그)입니다.

> API 기준: 출고 `POST /consumables/label/issue`(`{ conUid, department?, issueReason?, remark? }`), 출고취소 `POST /consumables/label/issue-return`(`{ conUid, returnReason? }`), 이력 조회 `GET /consumables/logs?logTypeGroup=ISSUING&startDate=&endDate=&limit=`. 화면 그리드의 `SELECT * FROM CONSUMABLE_LOGS ...`는 표시용 라벨이며 실제 조회는 위 logs API로 한다.

## 데이터 구조
```
CONSUMABLE_MASTERS (PK: CONSUMABLE_CODE)
   ├─ STOCK_QTY  (출고 -1 / 출고취소 +1 로 가감되는 보유 수량)
   └─ 1:N ─▶ CONSUMABLE_STOCKS (개별 인스턴스, PK: CON_UID)
                 └─ STATUS: PENDING → ACTIVE → ISSUED (취소 시 ACTIVE 복귀)

CONSUMABLE_LOGS (PK: TRANS_DATE + SEQ)  ← 출고/출고취소 이력 (SEQ_CONSUMABLE_LOGS 채번)
   └─ LOG_TYPE: OUT(출고) / OUT_RETURN(출고취소)  · 조회 그룹 logTypeGroup=ISSUING = In('OUT','OUT_RETURN')
```

## 출고/출고취소 상태전이 (운영 의미)
- **출고(`issueByScan`)**: `STATUS='ACTIVE'`인 UID만 허용. 아니면 400(`출고는 ACTIVE 상태만 가능합니다`). UID 없음은 404.
- **출고취소(`issueReturnByScan`)**: `STATUS='ISSUED'`인 UID만 허용. 아니면 400(`출고취소는 ISSUED 상태만 가능합니다`).
- 모든 처리는 1 UID = 수량 1. 다건은 UID를 순차 스캔(트랜잭션은 건별).

---

## ① 스캔 패널 (화면 입력 ↔ DTO)

| 화면 항목 | 전달 필드 (DTO) | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 출고 / 출고반품(모드 토글) | (FE 상태 `mode`) | `issue` → `/consumables/label/issue`, `issue-return` → `/consumables/label/issue-return` 호출 분기. DB 미저장. |
| UID 입력창 | `conUid` (IssueConDto / IssueReturnConDto) | 스캔/입력한 `CON_UID`. 필수. `CONSUMABLE_STOCKS` 단건 조회 키. |
| (자동/미노출) 출고부서 | `department` → `CONSUMABLE_LOGS.DEPARTMENT` | 출고 시 선택 전달 가능. 현재 스캔 패널은 미전달(null 저장). |
| (자동/미노출) 출고사유 | `issueReason` → `CONSUMABLE_LOGS.ISSUE_REASON` | 출고 사유. 현재 스캔 패널 미전달. |
| (자동/미노출) 비고 | `remark` → `CONSUMABLE_STOCKS.REMARK` | 출고 시 인스턴스 비고 갱신. 현재 미전달. |
| (취소) 취소사유 | `returnReason` → `CONSUMABLE_LOGS.RETURN_REASON` · `STOCKS.REMARK` | 출고취소 시 사유. 현재 스캔 패널 미전달(null). |

> `department`/`issueReason`/`remark`/`returnReason`는 DTO·DB에 존재하지만 현재 스캔 UI에서는 보내지 않아 null로 저장된다(향후 입력 확장 여지).

## ② 출고 이력 — CONSUMABLE_LOGS (표 컬럼 ↔ DB)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 일시 | `CREATED_AT` | 로그 생성 시각(TIMESTAMP, DEFAULT SYSTIMESTAMP). 조회 기간 필터는 `CREATED_AT` 기준 `Between(start,end)`. |
| 소모품코드 | `CONSUMABLE_CODE` | 마스터 FK(`CONSUMABLE_MASTERS.CONSUMABLE_CODE`). |
| 소모품명 | (조인) `CONSUMABLE_MASTERS.NAME` | `relations:['master']` 조인 후 `consumableName`으로 매핑. |
| UID | `CON_UID` | 출고된 개별 인스턴스 UID. nullable(레거시 수량형 로그 호환). |
| 유형 | `LOG_TYPE` | `OUT`(출고)/`OUT_RETURN`(출고취소). `logTypeGroup=ISSUING`은 `In('OUT','OUT_RETURN')`로 필터. |
| 수량 | `QTY` | INT, default 1. 화면은 OUT=`-`, OUT_RETURN=`+` 부호로 표시(저장값은 양수 1). |
| 라인 | `LINE_CODE` | 출고 라인(nullable). |
| 설비 | `EQUIP_CODE` | 출고 설비(nullable). |
| 비고 | `REMARK` | 메모(nullable). |
| (키) 거래일 | `TRANS_DATE` | 복합 PK. 당일 0시로 절삭 저장(`setHours(0,0,0,0)`). |
| (키) 순번 | `SEQ` | 복합 PK. `SEQ_CONSUMABLE_LOGS.NEXTVAL`로 채번. |
| (조건부) 출고부서 | `DEPARTMENT` | 출고 로그에만. |
| (조건부) 출고사유 | `ISSUE_REASON` | 출고 로그에만. |
| (조건부) 반납사유 | `RETURN_REASON` | 출고취소 로그에만. |
| 멀티테넌시 | `COMPANY` / `PLANT_CD` | `40` / `1000`(엔티티 속성 `company`/`plant`). |

## ③ 인스턴스 상태 — CONSUMABLE_STOCKS (출고 대상)

| DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|
| `CON_UID` | PK(자연키). 스캔 키. |
| `CONSUMABLE_CODE` | 마스터 FK. |
| `STATUS` | PENDING/ACTIVE/ISSUED/RETURNED 등. 출고=ACTIVE→ISSUED, 출고취소=ISSUED→ACTIVE. |
| `REMARK` | 출고/취소 시 전달된 remark·returnReason로 갱신. |
| `COMPANY` / `PLANT_CD` | 멀티테넌시(`40`/`1000`, 속성 `company`/`plantCd`). |

---

## 출고 처리 로직 (재고 가감)

### 출고 (`issueByScan`)
1. `CON_UID`로 `CONSUMABLE_STOCKS` 단건 조회 → 없으면 404.
2. `STATUS='ACTIVE'` 검증 → 아니면 400.
3. 트랜잭션 내에서:
   - `STATUS='ISSUED'`, `REMARK=remark` 저장.
   - `CONSUMABLE_MASTERS.STOCK_QTY -= 1`(`decrement`).
   - `SEQ_CONSUMABLE_LOGS.NEXTVAL` 채번 → `CONSUMABLE_LOGS`에 `LOG_TYPE='OUT'`, `QTY=1`, `CON_UID`, `DEPARTMENT`, `ISSUE_REASON` 기록.

### 출고취소 (`issueReturnByScan`)
1~2. 동일하게 조회 후 `STATUS='ISSUED'` 검증(아니면 400).
3. 트랜잭션 내에서:
   - `STATUS='ACTIVE'`, `REMARK=returnReason` 저장.
   - `CONSUMABLE_MASTERS.STOCK_QTY += 1`(`increment`).
   - `CONSUMABLE_LOGS`에 `LOG_TYPE='OUT_RETURN'`, `QTY=1`, `RETURN_REASON` 기록.

> 재고 수량의 단일 출처는 `CONSUMABLE_MASTERS.STOCK_QTY`이며 출고/취소로만 가감한다. 인스턴스 수준 추적은 `CONSUMABLE_STOCKS.STATUS`가 담당한다.

## 사전 설정 (마스터·공통코드)
- 출고 대상 UID는 [소모품입고](/consumables/receiving)에서 **입고확정(`ACTIVE`)** 되어 있어야 한다(미입고 PENDING은 출고 불가).
- UID 발행은 [소모품 마스터](/consumables/master) 기준으로 [소모품입고]에서 채번(`SEQ_CON_UID`/`F_GET_CON_UID`)된다.
- 유형 라벨(출고/출고반품)은 i18n(`consumables.issuing.typeOut`/`typeOutReturn`)으로 표시. `LOG_TYPE` 코드값 자체는 고정(OUT/OUT_RETURN).

## 운영 절차
1. 입고확정으로 UID를 `ACTIVE` 상태로 만든다(소모품입고 화면).
2. **출고** 모드로 UID 스캔 → 출고확정(`ACTIVE→ISSUED`, 재고 -1).
3. 오출고 시 **출고반품** 모드로 같은 UID 스캔 → 취소확정(`ISSUED→ACTIVE`, 재고 +1).
4. 이력 표에서 기간·유형 필터로 처리 내역 확인·내보내기.

## 권한
| 역할 | 가능 작업 |
|------|------|
| 창고/현장 담당자 | UID 스캔 출고·출고취소, 이력 조회 |
| 일반 사용자 | 이력 조회만 |

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 스캔 시 "UID를 찾을 수 없습니다"(404) | `CON_UID` 미존재 또는 타사/타플랜트 스코프 | UID·바코드 확인, 같은 COMPANY/PLANT_CD인지 확인 |
| 출고 시 "ACTIVE 상태만 가능합니다"(400) | UID가 PENDING(미입고)·ISSUED(이미 출고)·RETURNED | 소모품입고에서 입고확정 또는 현재 상태 확인 |
| 출고취소 시 "ISSUED 상태만 가능합니다"(400) | UID가 출고 상태가 아님 | 이미 ACTIVE면 취소 불필요. 상태 재확인 |
| 이력에 방금 건 안 보임 | 조회 기간 기본 오늘 하루 / 유형 필터 | 날짜 범위·유형 필터 조정 후 새로고침 |
| 재고수량이 안 맞음 | 수동 INSERT 등 정상 흐름 외 변경 | 출고/취소는 `STOCK_QTY` ±1만 수행. 인스턴스 STATUS와 로그 대조 |
| 출고부서/사유가 비어 저장됨 | 현재 스캔 패널이 해당 필드 미전달 | 정상(향후 입력 확장 항목). 사유 기록 필요 시 입출고 이력 등록 API 사용 |

## 데이터·연계
- 테이블: `CONSUMABLE_STOCKS`(상태전이 대상), `CONSUMABLE_LOGS`(출고/취소 이력), `CONSUMABLE_MASTERS`(재고수량 `STOCK_QTY`)
- 연계 화면: [소모품 마스터](/consumables/master), [소모품입고](/consumables/receiving), [소모품재고](/consumables/stock)
- API: `POST /consumables/label/issue`, `POST /consumables/label/issue-return`, `GET /consumables/logs?logTypeGroup=ISSUING`
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'` — 조회·출고·취소에 자동 적용
