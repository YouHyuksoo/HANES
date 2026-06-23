---
menuCode: EQUIP_PERIODIC_CALENDAR
audience: operator
title: 정기점검 캘린더 — 운영 가이드
summary: PERIODIC 점검의 캘린더 조회 및 실행 화면, DAILY와의 차이점, API 구조, 인터록 처리
tags: [설비, 점검, 정기, 캘린더, 운영, PERIODIC]
keywords: [EQUIP_PERIODIC_CALENDAR, 정기점검캘린더, PERIODIC, INSPECT_TYPE, CALENDAR_DAY_SUMMARY, 설비인터록]
related: [EQUIP_PERIODIC, EQUIP_INSPECT_CALENDAR]
---

# 정기점검 캘린더 — 운영 가이드

## 시스템 목적·역할
일상점검 캘린더(`EQUIP_INSPECT_CALENDAR`)와 동일한 3개 컴포넌트(InspectCalendar, DaySchedulePanel, InspectExecuteModal)를 재사용하여, `INSPECT_TYPE='PERIODIC'` 데이터를 캘린더로 조회하고 점검을 실행합니다.

## DAILY 캘린더와의 차이점

| 항목 | 일상점검 캘린더 | 정기점검 캘린더 |
|------|---------------|----------------|
| **INSPECT_TYPE** | `'DAILY'` | `'PERIODIC'` |
| **API 경로** | `/equipment/daily-inspect/calendar` | `/equipment/periodic-inspect/calendar` |
| **일별 API** | `/equipment/daily-inspect/calendar/day` | `/equipment/periodic-inspect/calendar/day` |
| **점검 실행 API** | POST/PUT `/equipment/daily-inspect` | POST/PUT `/equipment/periodic-inspect` |
| **타이틀** | 일상점검 캘린더 | 정기점검 캘린더 |
| **당월/차월 생성 버튼** | 있음 | 없음 |

## API 구조

### 월별 캘린더 요약
`GET /equipment/periodic-inspect/calendar?year={yyyy}&month={MM}[&processCode={code}]`

응답: `CalendarDaySummary[]` — 각 날짜별 total, completed, pass, fail, status

### 일별 설비 스케줄
`GET /equipment/periodic-inspect/calendar/day?date={yyyy-MM-dd}[&processCode={code}]`

응답: `DayScheduleEquip[]` — 설비별 equipCode, equipName, inspected, overallResult, items[]

## 점검 실행 모달 공유
`InspectExecuteModal`은 `inspectType` prop으로 `'PERIODIC'`을 전달받아 동일한 UI로 점검 실행:
- 점검자 선택(작업자 마스터 API)
- 항목별 PASS/FAIL 토글
- FAIL 시 원인/비고 필수 입력
- 종합결과 자동 산출
- 저장 시 POST(신규) 또는 PUT(수정)

## 인터록 처리
FAIL 결과 저장 시 `EquipMaster.status`가 `'INTERLOCK'`으로 자동 변경됩니다(DAILY와 동일).

## 권한
점검 결과 입력 권한(작업자/설비 관리자). 조회는 전체 사용자.

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| 캘린더에 데이터 없음 | 해당 월에 PERIODIC 점검 대상 설비 없음 | 정기점검 대상 설비 확인 |
| 날짜 선택 시 우측 패널이 빔 | 해당일 스케줄 데이터 없음 | 점검항목 매핑 및 주기 설정 확인 |
| 점검 저장 실패 | 점검자 미선택 또는 FAIL 사유 미입력 | 필수 입력 확인 |

## 데이터·연계
- **테이블**: `EQUIP_INSPECT_LOGS` (INSPECT_TYPE='PERIODIC')
- **공유 컴포넌트**: inspect-calendar/components/ 의 3개 컴포넌트
- **스코프**: `COMPANY='40'`, `PLANT_CD='1000'`
