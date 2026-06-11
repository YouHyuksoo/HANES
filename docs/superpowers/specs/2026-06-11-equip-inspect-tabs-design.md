# 설비점검 페이지 — 점검유형 탭 분리 설계

**날짜:** 2026-06-11  
**경로:** `/master/equip-inspect`

## 목적

우측 패널에 점검유형 4개 탭을 추가하여 유형별 항목을 분리 관리하고, 항목 추가 모달에서 점검유형 선택을 제거하고 설비유형 선택으로 풀 항목을 조회하도록 개선한다.

## 레이아웃

```
[좌측: 설비목록]  │  [일상점검 | 정기점검 | 예방보전 | 작업자점검]
                  │  선택된 설비 + 활성 탭 유형의 점검항목 그리드
```

## 컴포넌트별 변경

### EquipAssignTab.tsx

- `activeTab` 상태 추가: `"DAILY" | "PERIODIC" | "PM" | "WORKER"`, 기본값 `"DAILY"`
- 탭 UI 렌더링: 우측 패널 상단, 각 탭에 항목 카운트 배지
- `items` 전체 조회 후 `activeTab` 기준 클라이언트 필터 → `InspectItemPanel`에 전달
- `AddInspectItemModal`에 `inspectType={activeTab}` prop 전달 (모달 내부 select 대체)
- 삭제 API 경로 유지: `/master/equip-inspect-items/{equipCode}/{inspectType}/{seq}`

### InspectItemPanel.tsx

- `inspectType` 컬럼 제거 (탭이 이미 유형을 나타냄)
- props 변경 없음 (items 필터는 부모가 담당)

### AddInspectItemModal.tsx

- **제거:** `inspectType` Select 필드 (내부 state 포함)
- **추가 prop:** `inspectType: "DAILY" | "PERIODIC" | "PM" | "WORKER"` (부모에서 전달)
- **추가 state:** `selectedEquipType` — `equipType` prop으로 초기화, 사용자 변경 가능
- **추가 UI:** `ComCodeSelect` (groupCode="EQUIP_TYPE")
- pool 조회 조건: `inspectType` (prop) + `selectedEquipType` (state) 기준
- 모달 헤더 정보: 대상 설비 + 활성 점검유형 표시

## 데이터 흐름

```
EquipAssignTab
  ├── activeTab: DAILY
  ├── items (전체) → filteredItems (탭 필터)
  ├── InspectItemPanel(items=filteredItems)
  └── AddInspectItemModal(inspectType=activeTab, equipType=selectedEquip.equipType)
        └── ComCodeSelect(EQUIP_TYPE) → pool API 재조회
```

## 변경 파일

1. `EquipAssignTab.tsx`
2. `InspectItemPanel.tsx`
3. `AddInspectItemModal.tsx`
