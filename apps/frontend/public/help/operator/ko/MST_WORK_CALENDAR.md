---
menuCode: MST_WORK_CALENDAR
audience: operator
title: 생산월력관리 — 운영 가이드
summary: WORK_CALENDARS·WORK_CALENDAR_DAYS·SHIFT_PATTERNS 전체 컬럼 DB 매핑, 연간 생성·복사·확정 로직, 공통코드 연계, 권한, 트러블슈팅, 멀티테넌시 스코프
tags: [기준정보, 생산월력, 작업캘린더, 운영, 교대]
keywords: [WORK_CALENDARS, WORK_CALENDAR_DAYS, SHIFT_PATTERNS, CALENDAR_ID, DAY_TYPE, OFF_REASON, WORK_DAY_TYPE, DAY_OFF_TYPE, 연간생성, generateYear, copyFrom, confirm, unconfirm, CONFIRMED, DRAFT, 공휴일, 가용시간, 멀티테넌시]
related: [MST_PROCESS]
---

# 생산월력관리 — 운영 가이드

## 시스템 목적·역할
연도·공정별 근무 캘린더를 보유하는 기준정보 화면입니다. 헤더 **`WORK_CALENDARS`**, 일자별 상세 **`WORK_CALENDAR_DAYS`**, 교대 시간대 마스터 **`SHIFT_PATTERNS`** 세 테이블을 관리합니다. 여기서 확정한 가동일·가용시간(분)은 생산계획·CAPA·가동 캘린더 산정의 기준 데이터가 됩니다.

## 데이터 구조
```
WORK_CALENDARS (PK: CALENDAR_ID)
   │  UQ_WORK_CAL_YEAR_PROC: (COMPANY, PLANT_CD, CALENDAR_YEAR, PROCESS_CD) 유니크
   │  PROCESS_CD ──▶ PROCESS_MASTERS (null이면 공장 공통)
   └─ 1:N ─▶ WORK_CALENDAR_DAYS (PK: CALENDAR_ID, WORK_DATE)
                 · DAY_TYPE   ─▶ 공통코드 WORK_DAY_TYPE
                 · OFF_REASON ─▶ 공통코드 DAY_OFF_TYPE
                 · SHIFTS(CSV) ─▶ SHIFT_PATTERNS.SHIFT_CODE

SHIFT_PATTERNS (PK: COMPANY, PLANT_CD, SHIFT_CODE)  ── 독립 교대 마스터(탭)
```

## ① 캘린더 헤더 — WORK_CALENDARS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 캘린더ID | `CALENDAR_ID` | PK(자연키, VARCHAR2 50). 예 `WC-2026-PLANT01`. 일자(`WORK_CALENDAR_DAYS`)가 이 키로 연결되므로 불변. |
| 연도 | `CALENDAR_YEAR` | 적용 연도(VARCHAR2 4, YYYY). 연간 생성 범위(1/1~12/31)의 기준. |
| 공정 | `PROCESS_CD` | 공정 전용 캘린더 코드(nullable). null이면 공장 공통. `PROCESS_MASTERS` 참조(COMPANY/PLANT_CD/PROCESS_CD 조인). |
| 기본교대수 | `DEFAULT_SHIFT_COUNT` | NUMBER(1), 기본 1, 범위 1~3. 연간 생성·일자 기본값. |
| 기본교대패턴 | `DEFAULT_SHIFTS` | 교대코드 CSV(VARCHAR2 100, 예 `DAY,NIGHT`). 연간 생성 시 근무일 SHIFTS·가용시간 산출 기준. |
| 상태 | `STATUS` | `DRAFT`(기본)/`CONFIRMED`. CONFIRMED면 수정·생성·복사·삭제 차단(`ensureNotConfirmed`). |
| 비고 | `REMARK` | 메모(VARCHAR2 500). |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정 이력. CREATED_AT/UPDATED_AT은 TypeORM 타임스탬프. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | 회사/공장 스코프(`40`/`1000`). 모든 조회·저장에 적용. |

## ② 일자 상세 — WORK_CALENDAR_DAYS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| (헤더 연결) | `CALENDAR_ID` | PK 구성. 소속 캘린더. |
| 근무일자 | `WORK_DATE` | PK 구성(DATE). 월 조회는 `BETWEEN TO_DATE(...)`로 month(YYYY-MM) 범위 필터. |
| 근무유형 | `DAY_TYPE` | 기본 `WORK`. 공통코드 `WORK_DAY_TYPE`(WORK/OFF/HALF/SPECIAL). DTO에서 `IsIn(['WORK','OFF','HALF','SPECIAL'])` 검증. WORK/HALF/SPECIAL=가동일 집계, OFF=비가동. |
| 휴무사유 | `OFF_REASON` | nullable. 공통코드 `DAY_OFF_TYPE`. OFF일 때만 저장(프론트가 OFF 아니면 null 전송). 연간 생성은 주말=`WEEKEND`, 공휴일=`HOLIDAY`. |
| 교대수 | `SHIFT_COUNT` | NUMBER(1). 미지정 시 헤더 `DEFAULT_SHIFT_COUNT`. 휴무일 생성 시 0. |
| 교대패턴 | `SHIFTS` | 교대코드 CSV(VARCHAR2 100). 미지정 시 헤더 `DEFAULT_SHIFTS`. 휴무일 생성 시 null. |
| 가용시간 | `WORK_MINUTES` | NUMBER(5). 정규 가용 근무분. 연간 생성 시 기본교대패턴 근무분 합. 휴무 0. 요약에서 SUM. |
| 잔업시간 | `OT_MINUTES` | NUMBER(5), 기본 0. 잔업(분). 총가용시간 = WORK_MINUTES + OT_MINUTES. |
| 비고 | `REMARK` | 일자 메모(VARCHAR2 500). |
| 감사/테넌시 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT`, `COMPANY`, `PLANT_CD` | 이력 + 회사/공장 스코프. |

## ③ 교대패턴 — SHIFT_PATTERNS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 교대코드 | `SHIFT_CODE` | PK 구성(COMPANY/PLANT_CD/SHIFT_CODE 복합PK, VARCHAR2 20). 캘린더 SHIFTS가 참조. 수정 시 변경 불가. |
| 교대명 | `SHIFT_NAME` | 표시명(VARCHAR2 100, 예 주간/야간). |
| 시작시간 | `START_TIME` | HH:MM(VARCHAR2 5, 예 `08:00`). |
| 종료시간 | `END_TIME` | HH:MM(VARCHAR2 5, 예 `17:00`). |
| 휴식(분) | `BREAK_MINUTES` | NUMBER(4), 기본 60. 휴게 시간. |
| 근무(분) | `WORK_MINUTES` | NUMBER(5). 실 근무분. 캘린더 연간 생성 시 근무일 가용시간 = 기본교대패턴 코드들의 이 값 합. |
| 정렬순서 | `SORT_ORDER` | NUMBER(3). 목록 정렬(화면은 추가 시 length+1 자동 제안). |
| 사용여부 | `USE_YN` | `Y`/`N`, 기본 Y. 일자 편집 교대 선택 버튼은 `USE_YN='Y'`만 노출. |
| 감사/테넌시 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT`, `COMPANY`, `PLANT_CD` | 이력 + 공장 스코프. |

## 연간 생성·복사·확정 로직
- **연간 생성** `POST /master/work-calendars/:id/generate` (`generateYear`): 입력 `{ saturdayWork, sundayWork, applyHolidays(기본 true) }`.
  1. 확정 캘린더면 차단.
  2. 기본교대패턴 코드별 `SHIFT_PATTERNS.WORK_MINUTES` 합 = `defaultWorkMinutes`.
  3. 한국 고정 공휴일 Set 생성(1/1, 3/1, 5/5, 6/6, 8/15, 10/3, 10/9, 12/25). **음력·대체공휴일·임시공휴일은 미포함** — 운영자가 일자 편집으로 보정.
  4. 1/1~12/31 순회: 주말(미근무 옵션)→OFF/`WEEKEND`, 공휴일→OFF/`HOLIDAY`, 그 외 WORK. WORK는 SHIFT_COUNT=기본교대수·SHIFTS=기본교대패턴·WORK_MINUTES=defaultWorkMinutes.
  5. 트랜잭션으로 기존 일자 **전체 DELETE 후** 100건 배치 INSERT(덮어쓰기).
- **복사** `POST /:id/copy-from/:sourceId` (`copyFrom`): 원본 일자를 대상 CALENDAR_ID로 복제. 원본 일자 0건이면 404. 대상 기존 일자 DELETE 후 배치 INSERT.
- **일괄 저장** `PUT /:id/days/bulk`: 전달된 날짜의 min~max 범위를 DELETE 후 재INSERT(달력 1일 편집도 단건 배열로 호출).
- **확정/취소** `POST /:id/confirm`·`/unconfirm`: STATUS를 CONFIRMED/DRAFT로 토글. 확정 시 후속 수정 차단.
- **요약** `GET /:id/summary` (`getSummary`): `TO_CHAR(WORK_DATE,'YYYY-MM')` 그룹으로 월별·연간 근무/휴무/반일/특근일수·가용분·잔업분 집계.

## 사전 설정 (마스터·공통코드)
- 공통코드: `WORK_DAY_TYPE`(근무유형), `DAY_OFF_TYPE`(휴무사유). 미등록 시 일자 편집 셀렉트/달력 배지가 비거나 코드로만 표시.
- 마스터: `SHIFT_PATTERNS`(교대패턴 탭에서 선행 등록), `PROCESS_MASTERS`(공정 전용 캘린더용).
- 캘린더 생성 전 교대패턴을 먼저 등록해야 기본교대패턴·가용시간 자동 산출이 동작합니다.

## 운영 절차
1. 교대패턴(`SHIFT_PATTERNS`) 등록/점검 → 코드·시간·근무분.
2. 캘린더(`WORK_CALENDARS`) 생성: 연도·공정(또는 공장기본)·기본교대수·기본교대패턴.
3. 연간 생성으로 365/366일 골격 생성(주말·공휴일 옵션).
4. 음력 공휴일·대체공휴일·특근·반일·잔업 등 예외를 달력에서 일자 편집으로 보정.
5. 검증 후 **확정**으로 잠금. 변경 필요 시 확정취소 → 수정 → 재확정.

## 권한
- 기준정보 관리자: 캘린더/교대패턴 등록·수정·연간생성·복사·확정·삭제.
- 일반 사용자: 조회. (별도 권한 게이트는 메뉴/라우트 권한 정책을 따름)

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 저장·생성·복사·삭제가 막힘 | 캘린더가 `CONFIRMED` 상태 | 확정취소(`/unconfirm`)로 DRAFT 전환 후 재시도 |
| 캘린더 생성 시 중복 오류(409) | 동일 CALENDAR_ID, 또는 `UQ_WORK_CAL_YEAR_PROC`(회사/공장/연도/공정) 충돌 | ID 또는 공정 구분 변경. 공장기본은 공정 빈 1건만 허용 |
| 복사 시 "원본에 일정 없음"(404) | 원본 캘린더에 일자 데이터 미생성 | 원본을 먼저 연간 생성 후 복사 |
| 연간 생성 후 가용시간이 0 | 기본교대패턴 미지정 또는 해당 교대 WORK_MINUTES=0 | 헤더 기본교대패턴 지정 + 교대패턴 근무분 입력 |
| 음력 공휴일(설·추석 등)이 근무로 잡힘 | 고정 공휴일만 자동 적용(음력·대체공휴일 미포함) | 해당 일자를 OFF/`HOLIDAY`로 수동 보정 |
| 손으로 고친 휴무가 사라짐 | 연간 생성/복사 재실행이 일자 전체 덮어씀 | 보정은 생성/복사 이후에 수행 |
| 일자 편집에서 교대가 안 보임 | 교대패턴 `USE_YN='N'` | 교대패턴 사용여부 Y로 활성화 |
| 달력 셀 클릭이 안 됨 | 확정 상태(클릭 비활성) | 확정취소 후 편집 |

## 데이터·연계
- 테이블: `WORK_CALENDARS`, `WORK_CALENDAR_DAYS`, `SHIFT_PATTERNS`
- 공통코드: `WORK_DAY_TYPE`, `DAY_OFF_TYPE`
- 참조 마스터: `PROCESS_MASTERS`(공정 전용 캘린더)
- 활용: 생산계획·CAPA·가동 캘린더 등 가동일/가용시간 기준
- API: `/master/work-calendars`(CRUD, generate, copy-from, days, days/bulk, confirm, unconfirm, summary), `/master/shift-patterns`(CRUD)
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
