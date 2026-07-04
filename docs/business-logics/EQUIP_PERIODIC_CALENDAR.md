# 설비 정기점검 캘린더 (EQUIP_PERIODIC_CALENDAR) — 비즈니스 로직 & 데이터 흐름 분석
> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

## 1. 화면 개요
- **메뉴명:** 설비 정기점검 캘린더
- **경로:** `/equipment/periodic-inspect-calendar`
- **유형:** 스케줄 조회 + 점검 실행
- **주요 기능:** 일상점검 캘린더와 동일한 UI, inspectType=PERIODIC 고정

## 2. 화면 구성
일상점검 캘린더와 동일한 구조 (InspectCalendar, DaySchedulePanel, InspectExecuteModal 공유)

### 차이점
| 항목 | 일상점검 | 정기점검 |
|------|---------|---------|
| API Base Path | /equipment/daily-inspect | /equipment/periodic-inspect |
| inspectType | DAILY | PERIODIC |
| 마스터 필터 | inspectType=DAILY | inspectType=PERIODIC |

## 3. API 호출 흐름
- `GET /equipment/periodic-inspect/calendar` (year, month, processCode)
- `GET /equipment/periodic-inspect/calendar/day` (date, processCode)
- `GET /master/equip-inspect-items` (equipCode, inspectType=PERIODIC)
- `POST /equipment/periodic-inspect` (저장)
- `PUT /equipment/periodic-inspect/:equipCode/:date` (수정)

## 4. 백엔드 처리

### PeriodicInspectController (`apps/backend/src/modules/equipment/controllers/periodic-inspect.controller.ts`)
- `@Controller('equipment/periodic-inspect')`
- 모든 엔드포인트가 inspectType='PERIODIC'으로 고정
- 동일한 EquipInspectService 사용

## 5. DB 테이블
- EQUIP_INSPECT_LOGS (inspectType='PERIODIC')
- EQUIP_INSPECT_ITEM_POOL (inspectType='PERIODIC')
- EQUIP_MASTERS (참조)

## 6. 비고
- PeriodicInspectCalendarPage는 InspectCalendarPage의 inspectType=PERIODIC 변형
- 모든 공통 컴포넌트는 inspect-calendar/components/에서 공유
