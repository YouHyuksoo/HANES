---
sources:
  - apps/backend/src/modules/equipment/controllers/periodic-inspect.controller.ts
  - apps/frontend/src/app/(authenticated)/equipment/daily-inspect/components/EquipListPanel.tsx
  - apps/frontend/src/app/(authenticated)/equipment/daily-inspect/components/InspectEntryPanel.tsx
verifiedCommit: 8a7e96ea
---

# 설비 정기점검 (EQUIP_PERIODIC) — 비즈니스 로직 & 데이터 흐름 분석
> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

## 1. 화면 개요
- **메뉴명:** 설비 정기점검
- **경로:** `/equipment/periodic-inspect`
- **유형:** 점검 결과 일괄 입력 (PERIODIC)
- **주요 기능:** 일일점검과 동일한 좌/우 분할 구조, PERIODIC 점검 처리

## 2. 화면 구성
```
┌────────────────────────────────────────────────────────┐
│ Header (제목 + 날짜선택 + 새로고침)                     │
├──────────────────────┬─────────────────────────────────┤
│ EquipListPanel (7fr) │ InspectEntryPanel (12fr)        │
│ - PERIODIC 대상 설비  │ - apiBasePath="/equipment/      │
│ - 점검상태 표시       │   periodic-inspect"             │
│                      │ - inspectType="PERIODIC"         │
│                      │ - 커스텀 labels                  │
└──────────────────────┴─────────────────────────────────┘
```

## 3. API 호출 흐름
- `GET /master/equip-inspect-items` (inspectType=PERIODIC, useYn=Y)
- `GET /equipment/periodic-inspect` (inspectDateFrom/To)
- `GET /equipment/equips` (limit=500)
- `GET /master/workers` (limit=200, useYn=Y)
- InspectEntryPanel 통해 POST/PUT

## 4. 백엔드 처리
### PeriodicInspectController
동일한 구조, inspectType='PERIODIC' 고정

## 5. DB 테이블
- EQUIP_INSPECT_LOGS (inspectType='PERIODIC')
- EQUIP_INSPECT_ITEM_POOL
- EQUIP_MASTERS

## 6. 비고
- DailyInspectPage와 동일한 컴포넌트(EquipListPanel, InspectEntryPanel) 공유
- PeriodInspectPage의 labels는 useMemo로 오버라이드된 i18n 레이블 사용
