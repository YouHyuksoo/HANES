# 설비점검 점검유형 탭 분리 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/master/equip-inspect` 우측 패널에 점검유형 4탭을 추가하고, 항목 추가 모달에서 점검유형 select를 제거하며 설비유형 select를 추가한다.

**Architecture:** `EquipAssignTab`에 `activeTab` 상태를 추가하여 탭 UI를 렌더링하고 items를 클라이언트 필터링한다. `InspectItemPanel`에서 중복 컬럼을 제거하고, `AddInspectItemModal`은 `inspectType`을 prop으로 받고 `equipType`을 내부에서 선택 가능하게 한다.

**Tech Stack:** React, TypeScript, i18next, ComCodeSelect(EQUIP_TYPE), TanStack Table

---

## 파일 맵

| 파일 | 역할 |
|---|---|
| `apps/frontend/src/app/(authenticated)/master/equip-inspect/components/EquipAssignTab.tsx` | 탭 상태·UI, 항목 필터 |
| `apps/frontend/src/app/(authenticated)/master/equip-inspect/components/InspectItemPanel.tsx` | inspectType 컬럼 제거 |
| `apps/frontend/src/app/(authenticated)/master/equip-inspect/components/AddInspectItemModal.tsx` | inspectType prop화, equipType select 추가 |
| `apps/frontend/src/app/(authenticated)/master/equip-inspect/page.structure.test.mjs` | 구조 테스트 추가 |

---

### Task 1: AddInspectItemModal — inspectType prop화 + equipType select 추가

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/master/equip-inspect/components/AddInspectItemModal.tsx`

- [ ] **Step 1: Props 인터페이스 변경 — inspectType 추가, 내부 state 제거**

`AddInspectItemModal.tsx`의 `Props` 인터페이스를 아래로 교체한다.

```tsx
interface Props {
  isOpen: boolean;
  onClose: () => void;
  equipCode: string;
  equipName: string;
  equipType: string | null;
  inspectType: "DAILY" | "PERIODIC" | "PM" | "WORKER";  // 추가 (탭에서 전달)
  currentMaxSeq: number;
  onAdded: () => void;
}
```

함수 시그니처도 함께 수정한다.

```tsx
export default function AddInspectItemModal({
  isOpen, onClose, equipCode, equipName, equipType, inspectType, currentMaxSeq, onAdded
}: Props) {
```

- [ ] **Step 2: 내부 inspectType state 제거, selectedEquipType state 추가**

파일 상단의 기존 `inspectType` state 선언을 제거한다.

```tsx
// 제거할 줄:
const [inspectType, setInspectType] = useState<InspectItemPoolRow["inspectType"]>("DAILY");
```

`selectedEquipType` state를 추가한다.

```tsx
const [selectedEquipType, setSelectedEquipType] = useState<string>(equipType ?? "");
```

- [ ] **Step 3: useEffect — isOpen 시 selectedEquipType을 equipType prop으로 리셋**

기존 `isOpen` useEffect를 수정하여 `selectedEquipType`을 리셋한다.

```tsx
useEffect(() => {
  if (!isOpen) return;
  setSeq(String(currentMaxSeq + 1));
  setSelectedItemCode("");
  setSelectedEquipType(equipType ?? "");
}, [isOpen, currentMaxSeq, equipType]);
```

- [ ] **Step 4: pool 조회 useEffect — inspectType(prop) + selectedEquipType 사용**

기존 pool 조회 useEffect를 아래로 교체한다.

```tsx
useEffect(() => {
  if (!isOpen) return;
  setSelectedItemCode("");
  (async () => {
    try {
      const params: Record<string, string> = { useYn: "Y", inspectType, limit: "1000" };
      if (selectedEquipType) params.equipType = selectedEquipType;
      const res = await api.get("/master/equip-inspect-item-pool", { params });
      setPoolItems(res.data?.data ?? []);
    } catch {
      setPoolItems([]);
    }
  })();
}, [isOpen, inspectType, selectedEquipType]);
```

- [ ] **Step 5: typeOptions 및 inspectType select 렌더링 제거**

아래 두 블록을 파일에서 제거한다.

```tsx
// 제거: typeOptions useMemo
const typeOptions = useMemo(() => [
  { value: "DAILY", label: t("master.equipInspect.typeDaily") },
  ...
], [t]);
```

```tsx
// 제거: Select 렌더링 블록
<Select
  label={t("master.equipInspect.inspectType")}
  options={typeOptions}
  value={inspectType}
  onChange={value => setInspectType(value as InspectItemPoolRow["inspectType"])}
  fullWidth
/>
```

- [ ] **Step 6: ComCodeSelect import 추가 및 equipType select UI 삽입**

파일 상단 import에 `ComCodeSelect`를 추가한다.

```tsx
import { ComCodeSelect } from "@/components/shared";
```

대상 설비 표시 블록 아래(`<div className="space-y-4">` 직후)에 `ComCodeSelect`를 추가한다.

```tsx
<div className="space-y-4">
  <ComCodeSelect
    groupCode="EQUIP_TYPE"
    label={t("master.equip.type", "설비유형")}
    value={selectedEquipType}
    onChange={setSelectedEquipType}
    fullWidth
  />
  <div>
    <Select
      label={t("master.equipInspect.itemName", "점검항목")}
      ...
```

- [ ] **Step 7: 모달 헤더에 점검유형 표시 추가**

대상 설비 표시 `div` 내에 점검유형 배지를 추가한다.

```tsx
<div className="mb-4 p-3 rounded-lg bg-surface border border-border flex items-center gap-2 flex-wrap">
  <span className="text-sm text-text-muted">{t("master.equipInspect.targetEquip", "대상 설비")}: </span>
  <span className="font-mono font-medium text-text">{equipCode}</span>
  <span className="text-sm text-text-muted">{equipName}</span>
  {equipType && <ComCodeBadge groupCode="EQUIP_TYPE" code={equipType} />}
  <span className="ml-auto text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
    {t(`master.equipInspect.type${inspectType.charAt(0) + inspectType.slice(1).toLowerCase()}`, inspectType)}
  </span>
</div>
```

점검유형 레이블을 올바르게 표시하려면 아래 `inspectTypeLabel` 맵을 추가한다.

```tsx
const inspectTypeLabel = useMemo<Record<string, string>>(() => ({
  DAILY: t("master.equipInspect.typeDaily"),
  PERIODIC: t("master.equipInspect.typePeriodic"),
  PM: t("master.equipInspect.typePM", "예방보전"),
  WORKER: t("master.equipInspect.typeWorker", "작업자설비점검"),
}), [t]);
```

헤더 배지를 아래로 수정한다.

```tsx
<span className="ml-auto text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
  {inspectTypeLabel[inspectType] ?? inspectType}
</span>
```

- [ ] **Step 8: handleSave — inspectType을 prop에서 읽도록 확인**

기존 `handleSave`의 `inspectType`은 이미 prop을 참조하므로 변경 불필요. 그대로 유지한다.

```tsx
await api.post("/master/equip-inspect-items", {
  equipCode,
  itemCode: selectedItem.itemCode,
  inspectType,   // prop에서 전달받은 값
  seq: parseInt(seq, 10) || (currentMaxSeq + 1),
  useYn: "Y",
});
```

---

### Task 2: EquipAssignTab — 탭 상태·UI 추가 및 modal props 수정

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/master/equip-inspect/components/EquipAssignTab.tsx`

- [ ] **Step 1: activeTab 상태 추가**

```tsx
const [activeTab, setActiveTab] = useState<"DAILY" | "PERIODIC" | "PM" | "WORKER">("DAILY");
```

- [ ] **Step 2: 탭 레이블 상수 정의**

컴포넌트 함수 안, `useTranslation()` 호출 이후에 추가한다.

```tsx
const INSPECT_TABS = useMemo(() => [
  { key: "DAILY" as const,    label: t("master.equipInspect.typeDaily") },
  { key: "PERIODIC" as const, label: t("master.equipInspect.typePeriodic") },
  { key: "PM" as const,       label: t("master.equipInspect.typePM", "예방보전") },
  { key: "WORKER" as const,   label: t("master.equipInspect.typeWorker", "작업자점검") },
], [t]);
```

- [ ] **Step 3: filteredItems 파생 — activeTab 기준**

`fetchItems` 아래에 추가한다.

```tsx
const filteredItems = useMemo(
  () => items.filter(item => item.inspectType === activeTab),
  [items, activeTab],
);
```

- [ ] **Step 4: 우측 패널에 탭 UI 렌더링**

우측 `col-span-8` div의 내용을 아래로 교체한다.

```tsx
{/* 우측: 탭 + 점검항목 */}
<div className="col-span-8 flex flex-col min-h-0 gap-0">
  {/* 탭 헤더 */}
  <div className="flex border-b border-border flex-shrink-0">
    {INSPECT_TABS.map(tab => {
      const count = items.filter(i => i.inspectType === tab.key).length;
      return (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === tab.key
              ? "border-primary text-primary"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          {tab.label}
          {count > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === tab.key ? "bg-primary/10 text-primary" : "bg-surface text-text-muted"
            }`}>
              {count}
            </span>
          )}
        </button>
      );
    })}
  </div>

  {/* 점검항목 패널 */}
  <div className="flex-1 min-h-0 overflow-auto pt-4">
    <InspectItemPanel
      equip={selectedEquip}
      items={filteredItems}
      loading={itemLoading}
      onDelete={handleDelete}
      onOpenAddModal={() => setAddModalOpen(true)}
      onRefresh={fetchItems}
    />
  </div>
</div>
```

- [ ] **Step 5: AddInspectItemModal — inspectType prop 추가**

모달 컴포넌트 호출부를 수정한다.

```tsx
{selectedEquip && (
  <AddInspectItemModal
    isOpen={addModalOpen}
    onClose={() => setAddModalOpen(false)}
    equipCode={selectedEquip.equipCode}
    equipName={selectedEquip.equipName}
    equipType={selectedEquip.equipType || null}
    inspectType={activeTab}
    currentMaxSeq={filteredItems.reduce((max, i) => Math.max(max, i.seq), 0)}
    onAdded={handleAdded}
  />
)}
```

---

### Task 3: InspectItemPanel — inspectType 컬럼 제거

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/master/equip-inspect/components/InspectItemPanel.tsx`

- [ ] **Step 1: inspectType 컬럼 제거**

`columns` useMemo에서 아래 블록을 삭제한다.

```tsx
// 삭제할 컬럼 정의
{
  accessorKey: "inspectType", header: t("master.equipInspect.inspectType"), size: 90,
  cell: ({ getValue }) => {
    const v = getValue() as string;
    return <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${INSPECT_TYPE_COLORS[v]}`}>{inspectTypeLabels[v]}</span>;
  },
},
```

- [ ] **Step 2: 더 이상 사용하지 않는 import/상수 정리**

`INSPECT_TYPE_COLORS`가 import되어 있으나 컬럼 제거 후 미사용이므로 제거한다.

```tsx
// 수정 전:
import { EquipSummary, InspectItemRow, INSPECT_TYPE_COLORS } from "../types";

// 수정 후:
import { EquipSummary, InspectItemRow } from "../types";
```

`inspectTypeLabels` useMemo도 미사용이 되므로 제거한다.

```tsx
// 제거:
const inspectTypeLabels = useMemo<Record<string, string>>(() => ({
  DAILY: t("master.equipInspect.typeDaily"),
  PERIODIC: t("master.equipInspect.typePeriodic"),
  PM: t("master.equipInspect.typePM"),
  WORKER: t("master.equipInspect.typeWorker"),
}), [t]);
```

---

### Task 4: 구조 테스트 업데이트 및 빌드 검증

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/master/equip-inspect/page.structure.test.mjs`

- [ ] **Step 1: 테스트 파일에 탭 구조 검증 추가**

```mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(__dir, 'page.tsx'), 'utf8');
const assignTabSource = readFileSync(join(__dir, 'components/EquipAssignTab.tsx'), 'utf8');
const modalSource = readFileSync(join(__dir, 'components/AddInspectItemModal.tsx'), 'utf8');

test('page renders EquipAssignTab without ItemMasterTab', () => {
  assert.match(pageSource, /EquipAssignTab/);
  assert.doesNotMatch(pageSource, /ItemMasterTab/);
});

test('EquipAssignTab has activeTab state with 4 inspect types', () => {
  assert.match(assignTabSource, /activeTab/);
  assert.match(assignTabSource, /"DAILY"/);
  assert.match(assignTabSource, /"PERIODIC"/);
  assert.match(assignTabSource, /"PM"/);
  assert.match(assignTabSource, /"WORKER"/);
});

test('EquipAssignTab renders 4 tab buttons', () => {
  assert.match(assignTabSource, /INSPECT_TABS/);
  assert.match(assignTabSource, /setActiveTab/);
});

test('AddInspectItemModal does not have internal inspectType state', () => {
  assert.doesNotMatch(modalSource, /useState.*"DAILY"/);
  assert.doesNotMatch(modalSource, /setInspectType/);
});

test('AddInspectItemModal has equipType ComCodeSelect', () => {
  assert.match(modalSource, /selectedEquipType/);
  assert.match(modalSource, /EQUIP_TYPE/);
  assert.match(modalSource, /ComCodeSelect/);
});
```

- [ ] **Step 2: 테스트 실행**

```bash
node --test apps/frontend/src/app/\(authenticated\)/master/equip-inspect/page.structure.test.mjs
```

모든 테스트 PASS 확인.

- [ ] **Step 3: 타입 체크**

```bash
pnpm --filter @harness/frontend exec tsc --noEmit
```

에러 0건 확인.

- [ ] **Step 4: 커밋**

```bash
git add apps/frontend/src/app/\(authenticated\)/master/equip-inspect/
git commit -m "feat(equip-inspect): 점검유형 4탭 분리 + 모달 설비유형 선택 개선"
```
