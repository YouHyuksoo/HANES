---
menuCode: EQUIP_PERIODIC_CALENDAR
audience: operator
title: 정기점검 캘린더 — 운영 가이드
summary: 정기점검(PERIODIC) 캘린더의 전체 항목·DB 매핑, 주기(cycle) 스케줄 산정·종합판정·인터락 로직, 마스터 연계와 트러블슈팅
tags: [설비, 정기점검, 운영, PERIODIC, 예방보전]
keywords: [EQUIP_INSPECT_LOGS, EQUIP_INSPECT_ITEM_POOL, EQUIP_INSPECT_ITEM_MASTERS, EQUIP_MASTERS, INSPECT_TYPE, PERIODIC, cycle, isDue, OVERALL_RESULT, INTERLOCK, OVERDUE, DETAILS, 인터락]
related: [EQUIP_INSPECT_CALENDAR, EQUIP_INSPECT_ITEM, EQUIP_PERIODIC]
---

# 정기점검 캘린더 — 운영 가이드

## 시스템 목적·역할
설비 **정기점검(INSPECT_TYPE='PERIODIC')**을 월별 캘린더로 운영하는 화면입니다. 설비별 점검항목 매핑(`EQUIP_INSPECT_ITEM_POOL`)과 항목 마스터(`EQUIP_INSPECT_ITEM_MASTERS`)의 **주기(cycle)**를 기준으로 날짜별 점검 대상을 자동 산정하고, 점검 결과는 `EQUIP_INSPECT_LOGS`에 저장합니다. 일상점검 캘린더(`EQUIP_INSPECT_CALENDAR`)와 동일한 컴포넌트(InspectCalendar / DaySchedulePanel / InspectExecuteModal)를 `inspectType`·`apiBasePath` props로 재사용하며, **데이터는 INSPECT_TYPE로만 구분**됩니다(테이블은 공용).

## 데이터 구조
```
EQUIP_INSPECT_ITEM_MASTERS (항목 기준: 항목명·기준·CYCLE·기준이미지)
        │ (ITEM_CODE 참조)
        ▼
EQUIP_INSPECT_ITEM_POOL (설비별 항목 매핑, INSPECT_TYPE='PERIODIC', USE_YN='Y')
        │  + EQUIP_MASTERS (설비 정보)
        ▼  cycle 기준 isDue() → 날짜별 점검대상 산정
캘린더/일자패널 ──점검 실행──▶ EQUIP_INSPECT_LOGS (결과 1건/설비·일자, 항목결과는 DETAILS JSON)
```

---

## ① 점검 결과 — EQUIP_INSPECT_LOGS (전체 컬럼)
설비×점검유형×점검일 1건. 일상/정기/작업자 점검 공용 테이블.

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| (키) 설비 | `EQUIP_CODE` | 복합 PK1. 점검 대상 설비. |
| 점검유형 | `INSPECT_TYPE` | 복합 PK2. 이 화면은 **`PERIODIC` 고정**. (DAILY=일상, WORKER=작업자점검) |
| 점검일 | `INSPECT_DATE` | 복합 PK3. 캘린더에서 선택한 날짜(YYYY-MM-DD). |
| — | `WORK_DATE` | 조업일(서버 계산). |
| — | `INSPECT_AT` | 실제 점검 저장 시각(TIMESTAMP). |
| — | `OP_WINDOW_START_AT` / `OP_WINDOW_END_AT` | 조업창 시작/종료(저장 시 산정). |
| 점검자 | `INSPECTOR_NAME` | 점검 수행 작업자명. |
| 종합 판정 | `OVERALL_RESULT` | `PASS` / `FAIL` / `CONDITIONAL`(미사용). 항목 결과로 자동 산출. |
| 점검항목 결과 | `DETAILS` (CLOB) | 항목별 결과 JSON: `{items:[{itemId,seq,itemName,result,remark}]}`. 항목 PASS/FAIL·사유 저장. |
| 전체 비고 | `REMARK` | 점검 전체 메모. |
| — | `ORDER_NO` | 작업지시번호(WORKER 점검용, 정기점검은 미사용). |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | `40` / `1000` 스코프. |
| — | `CREATED_BY/AT`, `UPDATED_BY/AT` | 감사 컬럼. |

---

## ② 설비별 점검항목 매핑 — EQUIP_INSPECT_ITEM_POOL
어떤 설비에 어떤 정기점검 항목이 붙는지 정의. [설비별 점검항목] 화면에서 관리.

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 회사/사업장 | `COMPANY`, `PLANT_CD` | 복합 PK1·2. |
| 설비 | `EQUIP_CODE` | 복합 PK3. |
| 점검항목 | `ITEM_CODE` | 복합 PK4. 항목 마스터 참조. |
| 점검유형 | `INSPECT_TYPE` | 복합 PK5. **이 화면 대상은 `PERIODIC`**. |
| 사용여부 | `USE_YN` | `Y`만 스케줄 산정 대상. |
| 정렬순서 | `SORT_SEQ` | 점검 실행 시 항목 표시 순서. |

---

## ③ 점검항목 기준 마스터 — EQUIP_INSPECT_ITEM_MASTERS
항목명·판정기준·**주기(cycle)**·기준이미지의 원천.

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 항목코드 | `ITEM_CODE` | PK(회사·사업장 포함). |
| 항목명 | `ITEM_NAME` | 점검 실행 모달·태그에 표시. |
| 점검유형 | `INSPECT_TYPE` | `DAILY` / `PERIODIC`. |
| 설비유형 | `EQUIP_TYPE` | 필터/템플릿 분류. |
| 항목타입 | `ITEM_TYPE` | VISUAL/MEASUREMENT 등. |
| 판정 기준 | `CRITERIA` | 점검 실행 시 기준값/설명으로 표시. |
| **주기** | `CYCLE` | **`DAILY`/`WEEKLY`/`MONTHLY`. 날짜별 점검대상 산정(isDue)의 핵심.** |
| 측정 단위 | `UNIT` | 측정형 항목 단위. |
| 규격 하/상한 | `LSL_VALUE` / `USL_VALUE` | 측정형 판정 범위. |
| 작업자 QR | `WORKER_QR_CODE` | 작업자점검 연계용. |
| 기준 이미지 | `IMAGE_URL` | 점검 실행 모달에 참고 이미지로 표시. |
| 사용여부 | `USE_YN` | `Y`만 사용. |
| 비고 | `REMARK` | 메모. |

---

## ④ 설비 정보 — EQUIP_MASTERS (참조 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 설비코드/명 | `EQUIP_CODE` / `EQUIP_NAME` | 카드 표시. |
| 라인 | `LINE_CODE` | 카드 부가정보. |
| 설비유형 | `EQUIP_TYPE` | 카드 부가정보. |
| 공정 | `PROCESS_CODE` | **공정 필터** 기준. |
| 상태 | `STATUS` | `NORMAL` / `INTERLOCK`. **불합격 저장 시 자동 INTERLOCK**. |
| 사용여부 | `USE_YN` | `Y` 설비만 스케줄 대상. |

---

## 스케줄·판정 로직

### 주기별 점검대상 산정 (isDue)
`EQUIP_INSPECT_ITEM_MASTERS.CYCLE` 기준으로 각 날짜가 점검 대상인지 판정합니다.
- `DAILY` → 매일 대상
- `WEEKLY` → **월요일**(getDay()===1)만 대상
- `MONTHLY` → **매월 1일**(getDate()===1)만 대상
- 값 없음 → DAILY로 간주

### 날짜 상태(status) 산정
`GET /calendar`가 날짜별로 산정(우선순위 순):
1. 대상 설비 0 → `NONE`
2. 완료 ≥ 전체 AND 불합격 0 → `ALL_PASS`
3. 불합격 > 0 → `HAS_FAIL`
4. 0 < 완료 < 전체 → `IN_PROGRESS`
5. 완료 0 → 과거면 `OVERDUE`, 미래면 `NOT_STARTED`

### 종합판정(OVERALL_RESULT)
점검 실행 모달에서 자동 계산: **항목 결과에 `FAIL`이 1건이라도 있으면 `FAIL`**, 모두 `PASS`면 `PASS`. (전 항목 결과 입력 완료 시에만 확정)

### 인터락(INTERLOCK) 자동 처리
점검 저장(POST/PUT) 시 `OVERALL_RESULT`에 FAIL이 포함되면 `EQUIP_MASTERS.STATUS='INTERLOCK'`으로 자동 변경됩니다. 조치 후 설비 상태를 `NORMAL`로 복구해야 운영 재개됩니다.

## 사전 설정 (마스터·공통코드)
1. **점검항목 마스터**(`EQUIP_INSPECT_ITEM_MASTERS`)에 `INSPECT_TYPE='PERIODIC'` 항목과 **CYCLE** 등록.
2. **설비별 점검항목**(`EQUIP_INSPECT_ITEM_POOL`)에서 설비에 PERIODIC 항목을 `USE_YN='Y'`로 매핑.
3. 점검 대상 설비는 `EQUIP_MASTERS.USE_YN='Y'`.
4. 점검자 선택은 작업자 마스터를 사용.

## 운영 절차
1. 공정 필터·당월/차월 생성으로 대상 월 표시.
2. 캘린더 날짜 선택 → 일자패널에서 설비별 **점검 실행/편집**.
3. 항목 합·불 입력 후 저장 → `EQUIP_INSPECT_LOGS` upsert, 캘린더 갱신.
4. 불합격 발생 설비는 인터락 상태 확인 후 조치·복구.
5. 자동 스케줄 외 설비는 **개별 점검 추가**(설비 선택 → PERIODIC 항목 자동 로드)로 점검.

## 권한
- 점검 결과 입력: 작업자/설비 관리자.
- 조회: 전체 사용자.

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| 캘린더에 점검 대상 없음 | PERIODIC 항목 미매핑 또는 `USE_YN='N'` | `EQUIP_INSPECT_ITEM_POOL`에 PERIODIC 항목 매핑 확인 |
| 특정 날짜만 비어 있음 | CYCLE 조건 불일치(주간=월요일, 월간=1일) | 항목 마스터 CYCLE 설정 확인 |
| 점검 저장 실패 | 점검자 미선택/항목 미입력/FAIL 사유 누락 | 필수 입력 보완 후 재저장 |
| 저장 후 설비 사용 불가 | 불합격으로 INTERLOCK 자동 설정 | 원인 조치 후 `EQUIP_MASTERS.STATUS`를 NORMAL로 복구 |
| 일상점검 결과가 섞여 보임 | INSPECT_TYPE 혼동 | 본 화면은 PERIODIC만 조회(API base가 periodic-inspect) |

## 데이터·연계
- **테이블**: `EQUIP_INSPECT_LOGS`(INSPECT_TYPE='PERIODIC'), `EQUIP_INSPECT_ITEM_POOL`, `EQUIP_INSPECT_ITEM_MASTERS`, `EQUIP_MASTERS`
- **API**: `GET /equipment/periodic-inspect/calendar`(월 요약), `GET /equipment/periodic-inspect/calendar/day`(일 스케줄), `POST /equipment/periodic-inspect`(저장), `PUT /equipment/periodic-inspect/{equipCode}/{inspectDate}`(수정), `DELETE …`(삭제). 개별 추가 시 `GET /master/equip-inspect-items?inspectType=PERIODIC`.
- **일상점검과의 차이**: INSPECT_TYPE(`PERIODIC` vs `DAILY`)·apiBasePath만 다르고 테이블·컴포넌트·로직은 공용. 정기점검에는 일상점검의 `/check`(점검완료 확인) 엔드포인트가 없음.
- **연계 화면**: [설비별 점검항목](/master/equip-inspect), [정기점검 결과](/equipment/periodic-inspect), [일상점검 캘린더](/equipment/inspect-calendar)
- **멀티테넌시 스코프**: `COMPANY='40'`, `PLANT_CD='1000'`
