---
menuCode: EQUIP_PERIODIC
audience: operator
title: 정기점검 — 운영 가이드
summary: EQUIP_INSPECT_LOGS 테이블 PERIODIC 타입 점검, DAILY와의 차이점, 인터록 처리, 주기별 스케줄링
tags: [설비, 점검, 정기, 운영, PERIODIC, 결과, 인터록]
keywords: [EQUIP_INSPECT_LOGS, PERIODIC, 정기점검결과, OVERALL_RESULT, INTERLOCK, CYCLE, QUARTERLY, SEMI_ANNUAL, ANNUAL]
related: [EQUIP_PERIODIC_CALENDAR, EQUIP_DAILY]
---

# 정기점검 — 운영 가이드

## 시스템 목적·역할
`EQUIP_INSPECT_LOGS` 테이블에 `INSPECT_TYPE='PERIODIC'`로 저장되는 정기점검 결과를 등록·조회·수정합니다. 일상점검(DAILY)과 동일한 `EquipInspectService`를 사용하며, `inspectType`만 `'PERIODIC'`으로 고정됩니다.

## DAILY 점검과의 차이점

| 항목 | 일상점검(DAILY) | 정기점검(PERIODIC) |
|------|---------------|-------------------|
| **INSPECT_TYPE** | `'DAILY'` | `'PERIODIC'` |
| **주기** | 매일 | MONTHLY / QUARTERLY / SEMI_ANNUAL / ANNUAL |
| **API 경로** | `/equipment/daily-inspect` | `/equipment/periodic-inspect` |
| **항목 필터** | `inspectType=DAILY` | `inspectType=PERIODIC` |
| **컨트롤러** | `DailyInspectController` | `PeriodicInspectController` |
| **서비스** | `EquipInspectService` (동일) | `EquipInspectService` (동일) |
| **페이지 아이콘** | `ClipboardCheck` | `CalendarCheck` |
| **타이틀** | 일상점검 | 정기점검 |

## 일상점검과 동일한 사항
- `EquipListPanel`, `InspectEntryPanel` 컴포넌트 재사용
- 점검 저장 로직: POST(신규) / PUT(수정)
- 인터록 처리: FAIL 시 `EquipMaster.status = 'INTERLOCK'`
- DETAILS(CLOB) JSON 구조 동일

## 주기별 점검 스케줄링

`EquipInspectService`의 `getCalendarSummary()` 및 `getDaySchedule()`는 다음 기준으로 대상 설비를 결정합니다:

| CYCLE 값 | 점검 대상일 |
|---------|-----------|
| MONTHLY | 매월 1일 |
| QUARTERLY | 분기 첫째 날(1/1, 4/1, 7/1, 10/1) |
| SEMI_ANNUAL | 반기 첫째 날(1/1, 7/1) |
| ANNUAL | 매년 1월 1일 |

## 데이터 구조
`EQUIP_INSPECT_LOGS` (INSPECT_TYPE='PERIODIC') — DAILY와 완전히 동일한 테이블/컬럼 사용.

Perioidc 점검항목은 `EQUIP_INSPECT_ITEM_POOL`에서 `INSPECT_TYPE='PERIODIC'` 조건으로 필터링됩니다.

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| 설비 목록에 정기점검 대상이 안 보임 | PERIODIC 항목이 설비에 매핑되지 않음 | 설비별 점검항목 화면에서 PERIODIC 탭 → 추가 |
| 특정 설비의 점검 항목이 없음 | EQUIP_INSPECT_ITEM_POOL에 PERIODIC 연결 없음 | 마스터 등록 후 매핑 |
| 저장 버튼 비활성화 | 점검자 미선택 또는 일부 항목 판정 누락 | 모든 필수 입력 확인 |
| FAIL 저장 시 인터록 안 걸림 | 서버 예외 또는 트랜잭션 문제 | 로그 확인 |

## 데이터·연계
- **테이블**: `EQUIP_INSPECT_LOGS` (INSPECT_TYPE='PERIODIC'), `EQUIP_INSPECT_ITEM_POOL`, `EQUIP_MASTERS`
- **공유 컴포넌트**: daily-inspect/components/ 의 EquipListPanel, InspectEntryPanel
- **스코프**: `COMPANY='40'`, `PLANT_CD='1000'`
