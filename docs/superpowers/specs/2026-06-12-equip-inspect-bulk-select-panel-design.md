# 설비점검 점검항목 일괄선택 패널 설계

**날짜:** 2026-06-12  
**경로:** `/master/equip-inspect` — 점검항목 추가 UI

## 목적

기존 단건 선택 모달을 제거하고, 우측에서 슬라이드되는 패널로 교체한다. 패널은 점검항목 마스터 전체 목록을 보여주고 체크박스 다중선택 후 일괄 등록을 지원한다.

## 레이아웃

```
[좌측: 설비목록] │ [탭: 일상|정기|예방보전|작업자]
                 │ [그리드]
                 │
                 │ ←── 오른쪽에서 슬라이드인 (w-[480px]) ───→
                 │ ┌────────────────────────────────────────┐
                 │ │  EQ001 · 일상점검                 [✕]  │
                 │ │  설비유형: [ComCodeSelect] [검색창]    │
                 │ │  ──────────────────────────────────── │
                 │ │  ☑ INSP-001  오일 점검    판정형  주기 │
                 │ │  ☑ INSP-002  베어링 점검  측정형  주기 │
                 │ │  ─ INSP-003  필터 점검    판정형  (등록됨) ← disabled
                 │ │  ☐ INSP-004  전압 확인    측정형  주기 │
                 │ │  ──────────────────────────────────── │
                 │ │  2개 선택됨       [취소] [2개 일괄등록]│
                 │ └────────────────────────────────────────┘
```

## 컴포넌트 변경

### 신규: `InspectItemSelectPanel.tsx`

**Props:**
```ts
interface Props {
  isOpen: boolean;
  onClose: () => void;
  equipCode: string;
  equipName: string;
  inspectType: "DAILY" | "PERIODIC" | "PM" | "WORKER";
  registeredItemCodes: string[];  // 현재 탭에 이미 등록된 itemCode 목록
  onAdded: () => void;
}
```

**내부 상태:**
- `selectedEquipType: string` — 설비유형 필터 (초기 "")
- `searchText: string` — 항목명/코드 검색
- `masterItems: InspectItemMasterRow[]` — API 조회 결과
- `checkedCodes: Set<string>` — 선택된 itemCode 집합
- `saving: boolean`

**동작:**
1. `isOpen` 변경 시 상태 초기화
2. `inspectType` + `selectedEquipType` 변경 시 `/master/equip-inspect-item-masters` 조회
3. `registeredItemCodes`에 포함된 항목: 체크박스 disabled, "등록됨" 배지 표시
4. 나머지 항목: 체크박스 선택 가능
5. "N개 일괄등록" 버튼: `checkedCodes` 순서대로 `POST /master/equip-inspect-items` 순차 호출 → 완료 후 `onAdded()`

**애니메이션:**
- `fixed inset-0` backdrop (클릭 시 닫힘, `bg-black/40`)
- 패널: `fixed top-0 right-0 h-full w-[480px]`, `translate-x-full` → `translate-x-0` transition

**항목 행 구성:**
- 체크박스 (disabled if registered)
- itemCode (font-mono)
- itemName
- itemType 배지 (판정형/측정형)
- cycle
- "등록됨" 배지 (registered items만)

### 제거: `AddInspectItemModal.tsx`

기존 단건 선택 모달 파일 삭제.

### 수정: `EquipAssignTab.tsx`

- `AddInspectItemModal` import → `InspectItemSelectPanel` import 교체
- `registeredItemCodes` 파생: `filteredItems.map(i => i.itemCode).filter(Boolean) as string[]`
- 렌더링: `<InspectItemSelectPanel>` 교체 (props 정리)

## 데이터 흐름

```
EquipAssignTab
  filteredItems (activeTab 기준)
  registeredItemCodes = filteredItems.map(i => i.itemCode).filter(Boolean)

InspectItemSelectPanel (isOpen=true)
  → GET /master/equip-inspect-item-masters?inspectType={activeTab}&equipType={selectedEquipType}
  → 각 항목: registeredItemCodes 포함 여부 확인
  → 체크 후 저장: for each checkedCode → POST /master/equip-inspect-items
  → onAdded() → EquipAssignTab.fetchItems() → 탭 그리드 갱신
```

## 변경 파일

1. `components/InspectItemSelectPanel.tsx` — 신규
2. `components/AddInspectItemModal.tsx` — 삭제
3. `components/EquipAssignTab.tsx` — import 교체 + props 수정
