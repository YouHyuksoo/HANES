# 생산월력관리 (Work Calendar Management) 설계서

## 개요

MES 기준정보에 생산월력관리 기능을 추가한다. 하네스 제조 공장 특성상 라인 개념이 아닌 **공정(Process) 단위**로 월력을 관리하며, 공장 기본 월력과 공정별 월력을 독립적으로 운영한다.

## 핵심 설계 결정

- **관리 단위**: 공장(Plant) 기본 + 공정(Process)별 독립 월력
- **교대 관리**: 교대 패턴 마스터 + 일자별 교대 설정 포함
- **비가동 사유**: 공통코드(ComCode) 활용
- **생성 방식**: 연간 일괄 생성 + 월별 상세 편집
- **캘린더 독립성**: 각 캘린더는 완전한 365일 데이터 보유, fallback 없음. 공정별 월력 생성 시 공장 기본에서 복사(템플릿) 후 독립 수정
- **공휴일**: 한국 공휴일 하드코딩 목록 사용 (해외 공장 확장 시 별도 마스터 검토)

## 테이블 설계

### 1) SHIFT_PATTERNS — 교대 패턴 마스터

| 컬럼 | 타입 | PK | 설명 |
|------|------|:--:|------|
| COMPANY | VARCHAR2(50) | PK | 멀티테넌시 |
| PLANT_CD | VARCHAR2(50) | PK | 멀티테넌시 |
| SHIFT_CODE | VARCHAR2(20) | PK | 교대코드 (DAY, NIGHT, S1, S2, S3) |
| SHIFT_NAME | VARCHAR2(100) | | 교대명 (주간, 야간, 1조 등) |
| START_TIME | VARCHAR2(5) | | 시작시간 (HH:MM, 예: 08:00) |
| END_TIME | VARCHAR2(5) | | 종료시간 (HH:MM, 예: 17:00) |
| BREAK_MINUTES | NUMBER(4) | | 휴식시간(분), 기본 60 |
| WORK_MINUTES | NUMBER(5) | | 실가동시간(분) = 총시간 - 휴식 |
| SORT_ORDER | NUMBER(3) | | 정렬순서 |
| USE_YN | CHAR(1) | | 사용여부, 기본 Y |
| CREATED_BY | VARCHAR2(50) | | 생성자 |
| UPDATED_BY | VARCHAR2(50) | | 수정자 |
| CREATED_AT | TIMESTAMP | | 생성일시 |
| UPDATED_AT | TIMESTAMP | | 수정일시 |

### 2) WORK_CALENDARS — 월력 헤더

| 컬럼 | 타입 | PK | 설명 |
|------|------|:--:|------|
| CALENDAR_ID | VARCHAR2(50) | PK | 캘린더ID — 채번규칙 아래 참조 |
| CALENDAR_YEAR | VARCHAR2(4) | | 대상연도 |
| PROCESS_CD | VARCHAR2(50) | | 공정코드, NULL=공장기본 → FK PROCESS_MASTERS |
| DEFAULT_SHIFT_COUNT | NUMBER(1) | | 기본 교대수 (1/2/3) |
| DEFAULT_SHIFTS | VARCHAR2(100) | | 기본 교대패턴 CSV (예: DAY,NIGHT) — 교대 수 최대 3이므로 CSV 허용 |
| STATUS | VARCHAR2(20) | | DRAFT / CONFIRMED |
| REMARK | VARCHAR2(500) | | 비고 |
| COMPANY | VARCHAR2(50) | | 멀티테넌시 |
| PLANT_CD | VARCHAR2(50) | | 멀티테넌시 |
| CREATED_BY | VARCHAR2(50) | | 생성자 |
| UPDATED_BY | VARCHAR2(50) | | 수정자 |
| CREATED_AT | TIMESTAMP | | 생성일시 |
| UPDATED_AT | TIMESTAMP | | 수정일시 |

**유니크 제약**: `UNIQUE(COMPANY, PLANT_CD, CALENDAR_YEAR, PROCESS_CD)` — 같은 연도+공정에 중복 캘린더 방지. PROCESS_CD NULL인 경우 Oracle 함수 기반 유니크 인덱스 사용.

**CALENDAR_ID 채번 규칙**:
- 공장 기본: `WC-{YYYY}-{PLANT_CD}` (예: WC-2026-PLANT01)
- 공정별: `WC-{YYYY}-{PLANT_CD}-{PROCESS_CD}` (예: WC-2026-PLANT01-CRIMP)

### 3) WORK_CALENDAR_DAYS — 일자별 상세

| 컬럼 | 타입 | PK | 설명 |
|------|------|:--:|------|
| CALENDAR_ID | VARCHAR2(50) | PK | FK → WORK_CALENDARS |
| WORK_DATE | DATE | PK | 날짜 |
| DAY_TYPE | VARCHAR2(20) | | 공통코드(WORK_DAY_TYPE): WORK/OFF/HALF/SPECIAL |
| OFF_REASON | VARCHAR2(20) | | 공통코드(DAY_OFF_TYPE): DAY_TYPE이 OFF일 때 사유 |
| SHIFT_COUNT | NUMBER(1) | | 해당일 교대수 |
| SHIFTS | VARCHAR2(100) | | 해당일 교대코드 CSV (예: DAY,NIGHT) |
| WORK_MINUTES | NUMBER(5) | | 해당일 총 가용시간(분) — 자동계산 |
| OT_MINUTES | NUMBER(5) | | 잔업시간(분), 기본 0 |
| REMARK | VARCHAR2(500) | | 비고 (특근사유 등) |
| COMPANY | VARCHAR2(50) | | 멀티테넌시 |
| PLANT_CD | VARCHAR2(50) | | 멀티테넌시 |
| CREATED_BY | VARCHAR2(50) | | 생성자 |
| UPDATED_BY | VARCHAR2(50) | | 수정자 |
| CREATED_AT | TIMESTAMP | | 생성일시 |
| UPDATED_AT | TIMESTAMP | | 수정일시 |

### WORK_MINUTES 계산 로직

| DAY_TYPE | 계산식 |
|----------|--------|
| WORK | SUM(해당 SHIFTS의 각 SHIFT_PATTERN.WORK_MINUTES) + OT_MINUTES |
| HALF | SUM(해당 SHIFTS의 각 SHIFT_PATTERN.WORK_MINUTES) / 2 + OT_MINUTES |
| SPECIAL | SUM(해당 SHIFTS의 각 SHIFT_PATTERN.WORK_MINUTES) + OT_MINUTES |
| OFF | 0 + OT_MINUTES |

### 인덱스 설계

| 테이블 | 인덱스 | 용도 |
|--------|--------|------|
| WORK_CALENDARS | (COMPANY, PLANT_CD, CALENDAR_YEAR) | 연도별 조회 |
| WORK_CALENDARS | (PROCESS_CD) | 공정별 조회 |
| WORK_CALENDAR_DAYS | PK(CALENDAR_ID, WORK_DATE) | 일자 조회 |
| WORK_CALENDAR_DAYS | (WORK_DATE, DAY_TYPE) | 가동여부 조회 |
| SHIFT_PATTERNS | PK(COMPANY, PLANT_CD, SHIFT_CODE) | 교대패턴 조회 |

## API 설계

### /master/work-calendars

| Method | Path | 설명 |
|--------|------|------|
| GET | / | 목록 조회 (연도/공정 필터) |
| POST | / | 캘린더 헤더 생성 |
| PUT | /:calendarId | 헤더 수정 (DRAFT만) |
| DELETE | /:calendarId | 캘린더 삭제 (DRAFT만) |
| POST | /:calendarId/generate | 연간 일괄 생성 (365일 + 기본 패턴 적용) |
| POST | /:calendarId/copy-from/:sourceId | 다른 캘린더에서 복사 (대상에 기존 데이터 있으면 전체 덮어쓰기) |
| GET | /:calendarId/days | 일자 목록 조회 (월 필터) |
| PUT | /:calendarId/days/bulk | 일자 일괄 수정 (DRAFT만) |
| POST | /:calendarId/confirm | 확정 |
| POST | /:calendarId/unconfirm | 확정 취소 |
| GET | /:calendarId/summary | 월별 집계 |

**상태 제약**: CONFIRMED 상태에서는 헤더 수정, 일자 수정, 삭제 불가. 수정하려면 먼저 unconfirm 필요.

### /master/shift-patterns

| Method | Path | 설명 |
|--------|------|------|
| GET | / | 교대 패턴 목록 |
| POST | / | 교대 패턴 생성 |
| PUT | /:shiftCode | 수정 |
| DELETE | /:shiftCode | 삭제 |

### GET /:calendarId/summary 응답 형식

```json
{
  "calendarId": "WC-2026-PLANT01",
  "year": "2026",
  "monthly": [
    {
      "month": "01",
      "totalDays": 31,
      "workDays": 22,
      "offDays": 9,
      "halfDays": 0,
      "specialDays": 0,
      "totalWorkMinutes": 10560,
      "totalOtMinutes": 0
    }
  ],
  "yearly": {
    "totalDays": 365,
    "workDays": 248,
    "offDays": 117,
    "totalWorkMinutes": 119040,
    "totalOtMinutes": 0
  }
}
```

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
- 날짜 범위 드래그 → 일괄 변경 모달 (DAY_TYPE, 교대수, 사유, 잔업시간 설정)
- 월별 요약: 가동일수/총일수, 총가용시간, 잔업시간

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

menuConfig 등록: `{ code: "MST_WORK_CALENDAR", labelKey: "menu.master.workCalendar", path: "/master/work-calendar" }`

기존 MST_ROUTING 아래에 배치.

## 연간 일괄 생성 로직

1. 캘린더 헤더 생성 (연도, 공정, 기본교대 설정)
2. "생성" 호출 시 해당 연도 1/1 ~ 12/31 일자 레코드 생성
3. 토/일은 자동으로 OFF (REGULAR), 평일은 WORK
4. 한국 공휴일 자동 반영 (HOLIDAY) — 하드코딩 목록 사용
5. 각 WORK일의 SHIFT_COUNT, SHIFTS, WORK_MINUTES는 헤더 기본값으로 채움
6. OT_MINUTES 기본 0

### 한국 공휴일 목록 (연도별 고정일)

신정(1/1), 삼일절(3/1), 어린이날(5/5), 현충일(6/6), 광복절(8/15), 개천절(10/3), 한글날(10/9), 성탄절(12/25). 음력 공휴일(설날, 추석, 부처님오신날)은 매년 날짜가 다르므로 연도별 테이블로 관리.

## 복사 로직

1. 소스 캘린더의 모든 WORK_CALENDAR_DAYS를 대상 캘린더로 복사
2. CALENDAR_ID + COMPANY + PLANT_CD만 교체, 나머지 데이터 동일
3. 대상 캘린더에 기존 일자 데이터가 있으면 전체 삭제 후 복사 (덮어쓰기)
4. 복사 후 독립적으로 수정 가능
