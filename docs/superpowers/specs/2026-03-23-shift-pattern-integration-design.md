# 교대패턴 시스템 연동 설계

> **작성일**: 2026-03-23
> **상태**: Draft

---

## 1. 배경

현재 HANES MES에서 교대패턴(`SHIFT_PATTERNS`)은 월력(WorkCalendar) 연간 생성 시
`workMinutes` 계산에만 사용된다.

생산계획, 작업지시, 생산실적, 모니터링에서는 교대 정보를 전혀 활용하지 않고 있다.

교대패턴을 시스템 전반에 연동하여 **CAPA 계산**과 **교대별 실적 추적/분석**을
가능하게 한다.

---

## 2. 목표

1. **생산 CAPA 계산 시 교대별 가용 시간 반영**
2. **생산실적에 교대 자동 판별 기록** → 교대별 생산성/불량률 분석 가능

---

## 3. 설계

### 3.1 데이터 변경

#### ProdResult 엔티티에 SHIFT_CODE 컬럼 추가

| 항목 | 내용 |
|------|------|
| 컬럼명 | `SHIFT_CODE` |
| 타입 | `VARCHAR2(20)` |
| Nullable | `YES` |

- 생산실적 저장 시 `startAt`을 교대패턴의 `START_TIME` ~ `END_TIME`과 비교하여 자동 판별
- 야간 교대(20:00 ~ 05:00)처럼 자정을 넘는 경우도 처리
- 판별 실패 시 `NULL` (수동 수정 가능)

#### ProdPlan / JobOrder는 변경 없음

- 작업지시는 교대 무관하게 발행
- 실적 시점에 교대가 결정됨

---

### 3.2 교대 자동판별 로직 (백엔드)

#### ShiftResolver 유틸 생성

- **위치**: `apps/backend/src/utils/shift-resolver.ts` 또는 shared util
- **입력**: `startAt`(timestamp), `company`, `plant`

**처리 흐름**:

1. `SHIFT_PATTERNS` 테이블에서 해당 `company`, `plant`의 활성(`USE_YN = 'Y'`) 교대패턴 조회
2. `startAt`의 시:분을 추출
3. 각 교대패턴의 `START_TIME` ~ `END_TIME` 범위와 비교
4. **자정 넘김 처리**: `START_TIME > END_TIME`이면 (예: 20:00 ~ 05:00) 두 구간으로 분리 비교
   - 구간 1: `START_TIME` ~ `23:59`
   - 구간 2: `00:00` ~ `END_TIME`
5. 매칭되는 `shiftCode` 반환, 없으면 `null`

```text
예시)
  DAY   : 08:00 ~ 16:00
  SWING : 16:00 ~ 00:00  → 구간1: 16:00~23:59
  NIGHT : 00:00 ~ 08:00

  startAt = 2026-03-23 22:30 → SWING 매칭
  startAt = 2026-03-24 03:15 → NIGHT 매칭
```

#### ProdResultService 수정

- `create` / `update` 시 `startAt`이 있으면 `ShiftResolver`로 자동 판별
- 결과를 `SHIFT_CODE` 컬럼에 저장
- **사용자가 명시적으로 `shiftCode`를 지정한 경우 자동판별보다 우선**

---

### 3.3 CAPA 계산 연동

#### AutoPlanService 수정

**현재 방식**:
- 월력에서 `WORK` dayType 일수만 카운트하여 CAPA 계산

**변경 후**:

1. 월력의 각 `WORK` 일의 `shifts`(CSV) 파싱
2. 각 shift의 `workMinutes`를 `SHIFT_PATTERNS`에서 조회
3. 일별 가용시간 = 해당 일의 모든 교대 `workMinutes` 합산
4. 총 가용시간으로 CAPA 산출 (기존 단순 일수 방식 대체)

```text
예시)
  3월 근무일: 22일
  각 일의 교대: DAY(480min) + SWING(480min) = 960min/일
  월간 가용시간: 22 * 960 = 21,120분 = 352시간
```

---

### 3.4 모니터링 필터 추가

#### ProductionViewsController 수정

- 기존 생산진행현황 API에 `shift` 쿼리파라미터 추가
- `GET /production/views/progress?shift=DAY`
- `shift` 파라미터가 있으면 `ProdResult`의 `SHIFT_CODE`로 필터링

#### 프론트엔드 수정

- 생산진행현황 페이지에 **교대 드롭다운 필터** 추가
- `SHIFT_PATTERNS` API에서 옵션 목록 조회
- 선택 시 해당 교대 실적만 필터링

---

## 4. 영향 범위

| 파일 | 변경 내용 |
|------|----------|
| `prod-result.entity.ts` | `SHIFT_CODE` 컬럼 추가 |
| `PROD_RESULTS` 테이블 DDL | `ALTER TABLE ADD SHIFT_CODE` |
| `shift-resolver.ts` (신규) | 교대 자동판별 유틸 |
| `prod-result.service.ts` | 실적 저장 시 ShiftResolver 호출 |
| `auto-plan.service.ts` | CAPA 계산에 교대별 가용시간 반영 |
| `production-views.controller.ts` | `shift` 필터 파라미터 추가 |
| `production-views.service.ts` | `shift` 조건 쿼리 추가 |
| 프론트엔드 진행현황 페이지 | 교대 드롭다운 필터 추가 |

---

## 5. 제약사항

- `ProdPlan`, `JobOrder` 엔티티는 변경하지 않음
- 교대 판별 실패 시 `NULL` 허용 (강제하지 않음)
- 기존 데이터(`SHIFT_CODE`가 NULL인 실적)는 그대로 유지
