# 생산월력관리 (Work Calendar Management) 설계서

## 개요

MES 기준정보에 생산월력관리 기능을 추가한다. 하네스 제조 공장 특성상 라인 개념이 아닌 **공정(Process) 단위**로 월력을 관리하며, 공장 기본 월력과 공정별 월력을 독립적으로 운영한다.

## 핵심 설계 결정

- **관리 단위**: 공장(Plant) 기본 + 공정(Process)별 독립 월력
- **교대 관리**: 교대 패턴 마스터 + 일자별 교대 설정 포함
- **비가동 사유**: 공통코드(ComCode) 활용
- **생성 방식**: 연간 일괄 생성 + 월별 상세 편집
- **캘린더 독립성**: 각 캘린더는 완전한 365일 데이터 보유, fallback 없음. 공정별 월력 생성 시 공장 기본에서 복사(템플릿) 후 독립 수정

## 테이블 설계

### 1) SHIFT_PATTERNS — 교대 패턴 마스터

| 컬럼 | 타입 | PK | 설명 |
|------|------|:--:|------|
| SHIFT_CODE | VARCHAR2(20) | PK | 교대코드 (DAY, NIGHT, S1, S2, S3) |
| SHIFT_NAME | VARCHAR2(100) | | 교대명 (주간, 야간, 1조 등) |
| START_TIME | VARCHAR2(5) | | 시작시간 (HH:MM) |
| END_TIME | VARCHAR2(5) | | 종료시간 (HH:MM) |
| BREAK_MINUTES | NUMBER(4) | | 휴식시간(분), 기본 60 |
| WORK_MINUTES | NUMBER(5) | | 실가동시간(분) = 총시간 - 휴식 |
| SORT_ORDER | NUMBER(3) | | 정렬순서 |
| USE_YN | CHAR(1) | | 사용여부, 기본 Y |
| COMPANY | VARCHAR2(50) | | 멀티테넌시 |
| PLANT_CD | VARCHAR2(50) | | 멀티테넌시 |
| CREATED_BY | VARCHAR2(50) | | 생성자 |
| UPDATED_BY | VARCHAR2(50) | | 수정자 |
| CREATED_AT | TIMESTAMP | | 생성일시 |
| UPDATED_AT | TIMESTAMP | | 수정일시 |

### 2) WORK_CALENDARS — 월력 헤더

| 컬럼 | 타입 | PK | 설명 |
|------|------|:--:|------|
| CALENDAR_ID | VARCHAR2(50) | PK | 캘린더ID (WC-2026-PLANT01) |
| CALENDAR_YEAR | VARCHAR2(4) | | 대상연도 |
| PROCESS_CD | VARCHAR2(50) | | 공정코드, NULL=공장기본 → FK PROCESS_MASTERS |
| DEFAULT_SHIFT_COUNT | NUMBER(1) | | 기본 교대수 (1/2/3) |
| DEFAULT_SHIFTS | VARCHAR2(100) | | 기본 교대패턴 (DAY,NIGHT) |
| STATUS | VARCHAR2(20) | | DRAFT / CONFIRMED |
| REMARK | VARCHAR2(500) | | 비고 |
| COMPANY | VARCHAR2(50) | | 멀티테넌시 |
| PLANT_CD | VARCHAR2(50) | | 멀티테넌시 |
| CREATED_BY | VARCHAR2(50) | | 생성자 |
| UPDATED_BY | VARCHAR2(50) | | 수정자 |
| CREATED_AT | TIMESTAMP | | 생성일시 |
| UPDATED_AT | TIMESTAMP | | 수정일시 |

### 3) WORK_CALENDAR_DAYS — 일자별 상세

| 컬럼 | 타입 | PK | 설명 |
|------|------|:--:|------|
| CALENDAR_ID | VARCHAR2(50) | PK | FK → WORK_CALENDARS |
| WORK_DATE | DATE | PK | 날짜 |
| DAY_TYPE | VARCHAR2(20) | | 공통코드(WORK_DAY_TYPE): WORK/OFF/HALF/SPECIAL |
| OFF_REASON | VARCHAR2(20) | | 공통코드(DAY_OFF_TYPE): DAY_TYPE이 OFF일 때 사유 |
| SHIFT_COUNT | NUMBER(1) | | 해당일 교대수 |
| SHIFTS | VARCHAR2(100) | | 해당일 교대코드 (DAY,NIGHT) |
| WORK_MINUTES | NUMBER(5) | | 해당일 총 가용시간(분) — 자동계산 |
| REMARK | VARCHAR2(500) | | 비고 (특근사유 등) |

## API 설계

### /master/work-calendars

| Method | Path | 설명 |
|--------|------|------|
| GET | / | 목록 조회 (연도/공정 필터) |
| POST | / | 캘린더 헤더 생성 |
| PUT | /:calendarId | 헤더 수정 |
| DELETE | /:calendarId | 캘린더 삭제 (DRAFT만) |
| POST | /:calendarId/generate | 연간 일괄 생성 (365일 + 기본 패턴 적용) |
| POST | /:calendarId/copy-from/:sourceId | 다른 캘린더에서 복사 |
| GET | /:calendarId/days | 일자 목록 조회 (월 필터) |
| PUT | /:calendarId/days/bulk | 일자 일괄 수정 |
| POST | /:calendarId/confirm | 확정 |
| POST | /:calendarId/unconfirm | 확정 취소 |
| GET | /:calendarId/summary | 월별 가동일수/총가용시간 집계 |

### /master/shift-patterns

| Method | Path | 설명 |
|--------|------|------|
| GET | / | 교대 패턴 목록 |
| POST | / | 교대 패턴 생성 |
| PUT | /:shiftCode | 수정 |
| DELETE | /:shiftCode | 삭제 |

## 프론트엔드 화면 구성

**페이지: `/master/work-calendar`**

| 영역 | 내용 |
|------|------|
| 좌측 상단 | 연도 선택 + 공정 필터 + 캘린더 목록 (DataGrid) |
| 우측 상단 | 선택된 캘린더의 헤더 정보 폼 (연도, 공정, 기본교대, 상태) |
| 하단 | 달력 뷰 — 월 선택 탭 + 달력 그리드 |

**달력 뷰 색상 구분:**
- 근무일(WORK) = 파랑
- 휴무일(OFF) = 빨강
- 반일(HALF) = 노랑
- 특근(SPECIAL) = 초록

**달력 조작:**
- 날짜 클릭 → DAY_TYPE 토글 (WORK ↔ OFF)
- 날짜 범위 드래그 → 일괄 변경 모달 (DAY_TYPE, 교대수, 사유 설정)
- 월별 요약: 가동일수/총일수, 총가용시간

**교대 패턴 관리:** 별도 탭으로 SHIFT_PATTERNS CRUD

## 공통코드 추가

### WORK_DAY_TYPE (근무일 유형)

| 코드 | 명칭 |
|------|------|
| WORK | 근무일 |
| OFF | 휴무일 |
| HALF | 반일근무 |
| SPECIAL | 특근 |

### DAY_OFF_TYPE (휴무 사유)

| 코드 | 명칭 |
|------|------|
| HOLIDAY | 공휴일 |
| REGULAR | 정기휴무 |
| MAINTENANCE | 설비보전 |
| COMPANY | 회사휴무 |
| OTHER | 기타 |

## 메뉴 등록

```
기준정보 (MASTER)
└─ MST_WORK_CALENDAR → /master/work-calendar (생산월력관리)
```

기존 MST_ROUTING 아래에 배치.

## 연간 일괄 생성 로직

1. 캘린더 헤더 생성 (연도, 공정, 기본교대 설정)
2. "생성" 호출 시 해당 연도 1/1 ~ 12/31 일자 레코드 생성
3. 토/일은 자동으로 OFF (REGULAR), 평일은 WORK
4. 한국 공휴일 자동 반영 (HOLIDAY)
5. 각 WORK일의 SHIFT_COUNT, SHIFTS, WORK_MINUTES는 헤더 기본값으로 채움

## 복사 로직

1. 소스 캘린더의 모든 WORK_CALENDAR_DAYS를 대상 캘린더로 복사
2. CALENDAR_ID만 교체, 나머지 데이터 동일
3. 복사 후 독립적으로 수정 가능
