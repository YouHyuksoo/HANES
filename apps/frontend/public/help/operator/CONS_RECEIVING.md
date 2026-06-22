---
menuCode: CONS_RECEIVING
audience: operator
title: 소모품 입고 — 운영 가이드
summary: 소모품 입고의 두 경로(바코드 스캔 라벨 확정 / 수동 IN)와 DB 매핑(CONSUMABLE_LOGS·CONSUMABLE_STOCKS·CONSUMABLE_MASTERS), 재고 반영·부호 로직, 채번, 권한, 트러블슈팅, 멀티테넌시
tags: [소모품, 입고, 수불, 운영]
keywords: [소모품입고, 입고, 반납입고, IN, IN_RETURN, CONSUMABLE_LOGS, CONSUMABLE_STOCKS, CONSUMABLE_MASTERS, STOCK_QTY, conUid, CON_UID, PENDING, ACTIVE, SEQ_CONSUMABLE_LOGS, 채번, 재고반영, 입고구분, NEW, REPLACEMENT, 멀티테넌시, COMPANY, PLANT_CD]
related: [CONS_MASTER, CONS_LABEL, CONS_STOCK]
---

# 소모품 입고 — 운영 가이드

## 시스템 목적·역할
소모품을 **창고 보유 재고로 확정**하는 입고 처리 화면입니다. 입고가 처리되면 소모품 마스터(`CONSUMABLE_MASTERS.STOCK_QTY`)의 보유 재고가 증감하고, 입출고 이력 테이블(`CONSUMABLE_LOGS`)에 거래 1건이 채번·기록됩니다. 입고에는 두 경로가 있습니다.

> 입고 경로는 둘이다.
> - **① 바코드 스캔 입고**(`POST /consumables/label/confirm`): 라벨발행으로 채번된 개별 인스턴스(`CONSUMABLE_STOCKS`, `CON_UID`)를 `PENDING → ACTIVE`로 확정. UID 단위 추적.
> - **② 수동 입고**(`POST /consumables/receiving`, `logType: 'IN'`): UID 없이 소모품 코드 + 수량으로 재고 증가. `CONSUMABLE_STOCKS` 인스턴스는 생성하지 않음.

## 데이터 구조
```
CONSUMABLE_MASTERS (PK: CONSUMABLE_CODE, STOCK_QTY = 보유 재고)
   ├─ 1:N ─▶ CONSUMABLE_STOCKS (PK: CON_UID, status PENDING→ACTIVE→…) ← 스캔 입고 대상
   └─ 1:N ─▶ CONSUMABLE_LOGS   (복합 PK: TRANS_DATE + SEQ, 입출고 이력) ← 두 경로 모두 기록
```
- 스캔 입고: `CONSUMABLE_STOCKS` 상태 전이 + `CONSUMABLE_LOGS`(IN) 1건 + `STOCK_QTY +1`.
- 수동 입고: `CONSUMABLE_LOGS`(IN) 1건 + `STOCK_QTY += qty`. (인스턴스 미생성)

## API
| 동작 | 메서드 · 경로 | 설명 |
|------|------|------|
| 미입고 대기 목록 | `GET /consumables/label/pending` | `CONSUMABLE_STOCKS.STATUS='PENDING'` 목록 |
| 스캔 입고 확정 | `POST /consumables/label/confirm` `{ conUid, location?, remark? }` | PENDING→ACTIVE, `STOCK_QTY +1`, IN 로그 |
| 스캔 반납입고 | `POST /consumables/label/return` `{ conUid, returnReason? }` | ACTIVE→RETURNED, `STOCK_QTY -1`, IN_RETURN 로그 |
| 다건 스캔 입고 | `POST /consumables/label/confirm-bulk` `{ conUids[], location? }` | confirm 순차 반복 |
| 수동 입고 | `POST /consumables/receiving` `{ consumableId, qty, logType:'IN', … }` | `STOCK_QTY += qty`, IN 로그 (인스턴스 미생성) |
| 입고 이력 목록 | `GET /consumables/logs` | `logType` / `logTypeGroup=RECEIVING` / 기간 필터 |

> 화면 그리드의 `SELECT * FROM CONSUMABLE_LOGS …`는 표시용 라벨일 뿐, 실제 조회는 위 API를 거친다.

---

## ① 바코드 스캔 패널 ↔ DB

| 화면 항목 | DB 컬럼 / 파라미터 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 입고/반납 모드 | (요청 분기) | 입고=`/label/confirm`, 반납=`/label/return` 호출. |
| UID 바코드 | `ConfirmConReceivingDto.conUid` → `CONSUMABLE_STOCKS.CON_UID` | 라벨발행 시 채번된 개별 인스턴스 PK. Enter 입력 시 즉시 처리. |
| 보관위치(입고) | `ConfirmConReceivingDto.location` → `CONSUMABLE_STOCKS.LOCATION` | 입고 확정 시 해당 UID의 보관위치로 기록(선택). |
| 반품사유(반납) | `ReturnConReceivingDto.returnReason` → `CONSUMABLE_STOCKS.REMARK`, `CONSUMABLE_LOGS.RETURN_REASON` | 반납 사유. 인스턴스 비고와 로그 사유에 기록. |

### 미입고 대기 목록 — CONSUMABLE_STOCKS (STATUS='PENDING')
| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| UID | `CON_UID` | 인스턴스 PK. |
| 소모품코드 | `CONSUMABLE_CODE` | 마스터 FK. |
| 소모품명 | `CONSUMABLE_MASTERS.NAME` | 마스터에서 조인(속성명 `consumableName`). |
| 카테고리 | `CONSUMABLE_MASTERS.CATEGORY` | 공통코드 `CONSUMABLE_CATEGORY`(MOLD/JIG/TOOL). |
| 라벨인쇄일 | `LABEL_PRINTED_AT` | 라벨 발행 시각. |
| 공급업체명 | `VENDOR_NAME` | 라벨 발행 시 입력값(`VENDOR_CODE`도 보유). |

## ② 입고 이력 그리드 — CONSUMABLE_LOGS (전체 표시 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 일시 | `CREATED_AT` | 처리 시각(TIMESTAMP). 정렬 기준(DESC). |
| (키) 거래일 | `TRANS_DATE` | 복합 PK. 입고 처리일 자정(`00:00`)으로 저장. |
| (키) 일련번호 | `SEQ` | 복합 PK. `SEQ_CONSUMABLE_LOGS` 시퀀스로 채번. |
| 소모품코드 | `CONSUMABLE_CODE` | 마스터 FK. |
| 소모품명 | `CONSUMABLE_MASTERS.NAME` | 조인 표시. |
| UID | `CON_UID` | 스캔 입고만 채워짐. 수동 입고는 null → `-`. |
| 유형 | `LOG_TYPE` | `IN`(입고)/`IN_RETURN`(입고반품). 수불 전체로는 OUT/OUT_RETURN/USAGE/REPLACE도 존재. |
| 수량 | `QTY` | 입고/반납 수량(INT, default 1). 화면은 IN `+`, IN_RETURN `-` 표기(저장값은 양수). |
| 공급업체코드 | `VENDOR_CODE` | 공급업체 코드. |
| 공급업체명 | `VENDOR_NAME` | 공급업체 이름. |
| 단가 | `UNIT_PRICE` | NUMBER(12,2). 입고 단가. |
| 입고구분 | `INCOMING_TYPE` | `NEW`(신규)/`REPLACEMENT`(교체). 스캔 입고는 `NEW` 고정. |
| 비고 | `REMARK` | 입고/반납 메모. |
| 반품사유 | `RETURN_REASON` | 반납입고 사유(IN_RETURN). |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `UPDATED_AT` | 생성/수정 이력. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | `40` / `1000` 스코프(엔티티 속성명 `company`, `plant`). |

> 출고 전용 컬럼 `DEPARTMENT`/`LINE_CODE`/`EQUIP_CODE`/`ISSUE_REASON`은 같은 테이블에 있으나 입고 화면에서는 사용하지 않는다(출고 화면 `CONS_ISSUING`에서 사용).

## ③ 수동 입고 폼 ↔ CONSUMABLE_LOGS

`POST /consumables/receiving`은 본문에 `logType:'IN'`을 강제로 채워 `createLog`로 처리한다.

| 화면 항목 | DTO 필드 → DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 소모품 | `consumableId` → `CONSUMABLE_CODE` | 존재 검증(없으면 404). |
| 수량 | `qty` → `QTY` | `STOCK_QTY += qty`. 기본 1, 최소 1. |
| 입고구분 | `incomingType` → `INCOMING_TYPE` | NEW/REPLACEMENT. |
| 공급업체코드/명 | `vendorCode`/`vendorName` → `VENDOR_CODE`/`VENDOR_NAME` | 공급업체. |
| 단가 | `unitPrice` → `UNIT_PRICE` | 입고 단가(선택). |
| 비고 | `remark` → `REMARK` | 메모(선택). |

## 입고 / 재고 반영 로직
**수동 입고(`createLog`)의 재고 부호** — `logType`별 `stockDelta`:
- `IN` → `+qty`, `OUT` → `-qty`, `IN_RETURN` → `-qty`, `OUT_RETURN` → `+qty`.
- `stockDelta < 0`이고 `STOCK_QTY + stockDelta < 0`이면 **재고 부족 400**.
- 트랜잭션: `CONSUMABLE_LOGS` 1건 저장 + `CONSUMABLE_MASTERS.STOCK_QTY` 갱신(원자적). IN일 때 `LAST_REPLACE`도 현재로 갱신.

**스캔 입고 확정(`confirmReceiving`)**:
1. `CON_UID` 조회. `STATUS != 'PENDING'`이면 **400**(이미 입고).
2. `STATUS='ACTIVE'`, `RECV_DATE`=현재, `LOCATION`/`REMARK` 갱신.
3. `CONSUMABLE_MASTERS.STOCK_QTY` **+1**.
4. `CONSUMABLE_LOGS` IN 로그 1건(`CON_UID` 포함, `INCOMING_TYPE='NEW'`).

**스캔 반납(`returnByScan`)**: `STATUS='ACTIVE'`만 허용(아니면 400) → `STATUS='RETURNED'`, `STOCK_QTY -1`, IN_RETURN 로그.

## 채번
- `CONSUMABLE_LOGS.SEQ`: Oracle 시퀀스 `SEQ_CONSUMABLE_LOGS.NEXTVAL`. `TRANS_DATE`(자정)와 함께 복합 PK.
- `CON_UID`(인스턴스): 라벨발행 단계(`CONS_LABEL`)에서 채번 서비스 `CON_UID` 채널로 발급. 입고 화면은 채번하지 않고 기존 UID를 확정만 한다.

## 사전 설정
- [소모품 마스터](`CONSUMABLE_MASTERS`)에 입고 대상 소모품이 `USE_YN='Y'`로 등록되어 있어야 한다.
- 스캔 입고는 [소모품 라벨발행](`CONS_LABEL`)에서 `CON_UID`가 발행되어 PENDING 상태로 존재해야 한다.
- 보관위치 선택지는 위치 마스터(`useLocationOptions`) 기준.
- 공통코드: `CONSUMABLE_CATEGORY`(대기 목록 카테고리 배지).

## 운영 절차
1. 라벨발행으로 `CON_UID` 발행(스캔 입고 경로) → 미입고 대기 목록에 노출.
2. 입고 모드에서 UID 스캔 → 입고 확정(재고 +1, IN 로그).
3. UID 없는 건은 **입고등록** 폼으로 수동 입고(재고 += qty).
4. 오입고는 **반납** 모드로 UID 스캔(ACTIVE→RETURNED, 재고 -1).
5. 입고 이력 그리드(기간·유형 필터)로 검증.

## 권한
소모품/자재 담당자(입고·반납 처리). 일반 사용자는 조회.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 미입고 대기 목록이 비어 있음 | `CON_UID` 미발행 또는 모두 입고됨 | [소모품 라벨발행]에서 UID 발행 후 재시도 |
| 스캔 시 "이미 입고된 상태"(400) | `STATUS != 'PENDING'`(이미 ACTIVE 등) | 입고 이력 확인. 중복 입고 아님 |
| 스캔 시 "UID를 찾을 수 없습니다"(404) | 오타/타 사업장 UID/미발행 | UID·멀티테넌시(`COMPANY`/`PLANT_CD`) 확인 |
| 반납이 막힘(400) | UID가 ACTIVE 상태가 아님 | 입고 확정된(활성) UID만 반납 가능 |
| 수동 입고 등록 버튼 비활성 | 소모품 미선택 | 돋보기로 소모품 선택 |
| 수동 입고/반납 "재고 부족"(400) | `STOCK_QTY + delta < 0` | 차감 경로(반납)에서 현재 재고 확인 |
| 입고했는데 재고 안 늘어남 | 다른 사업장 스코프 조회 | `COMPANY='40'`/`PLANT_CD='1000'` 스코프 확인 |

## 데이터·연계
- 테이블: `CONSUMABLE_LOGS`(입출고 이력), `CONSUMABLE_STOCKS`(개별 인스턴스/상태), `CONSUMABLE_MASTERS`(보유 재고 `STOCK_QTY`)
- 연계: [소모품 라벨발행](`CONS_LABEL`, `CON_UID` 채번), [소모품 마스터](`CONSUMABLE_MASTERS`), [소모품 재고](`CONS_STOCK`), 소모품 출고(`CONS_ISSUING`, 동일 로그 테이블)
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
