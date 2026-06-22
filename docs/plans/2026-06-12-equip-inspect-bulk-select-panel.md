# 설비점검 점검항목 일괄선택 패널 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 점검항목 추가 UI를 단건 모달에서 우측 슬라이드 패널 + 체크박스 다중선택 + 일괄 등록으로 교체한다.

**Architecture:** `AddInspectItemModal`을 삭제하고 `InspectItemSelectPanel`을 신규 생성한다. 패널은 `fixed right-0` 위치에서 `translateX` 트랜지션으로 슬라이드인하며, `registeredItemCodes`(현재 탭의 이미 등록된 항목) 비교로 중복 항목을 disabled 처리한다. 일괄 저장은 선택된 코드를 순서대로 순차 POST 한다.

**Tech Stack:** React, TypeScript, TailwindCSS, i18next, ComCodeSelect, ComCodeBadge

---

## 파일 맵

| 파일 | 변경 |
|---|---|
| `apps/frontend/src/app/(authenticated)/master/equip-inspect/components/InspectItemSelectPanel.tsx` | 신규 생성 |
| `apps/frontend/src/app/(authenticated)/master/equip-inspect/components/AddInspectItemModal.tsx` | 삭제 |
| `apps/frontend/src/app/(authenticated)/master/equip-inspect/components/EquipAssignTab.tsx` | import 교체, `registeredItemCodes` 전달 |
| `apps/frontend/src/app/(authenticated)/master/equip-inspect/page.structure.test.mjs` | 패널 구조 테스트 추가 |

---

### Task 1: InspectItemSelectPanel 신규 생성

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/master/equip-inspect/components/InspectItemSelectPanel.tsx`

- [ ] **Step 1: 파일 전체 작성**

아래 전체 코드를 그대로 작성한다.

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Search } from "lucide-react";
import { Button, Input, ComCodeBadge } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";
import { InspectItemMasterRow, ITEM_TYPE_COLORS } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  equipCode: string;
  equipName: string;
  inspectType: "DAILY" | "PERIODIC" | "PM" | "WORKER";
  registeredItemCodes: string[];
  onAdded: () => void;
}

export default function InspectItemSelectPanel({
  isOpen, onClose, equipCode, equipName, inspectType, registeredItemCodes, onAdded,
}: Props) {
  const { t } = useTranslation();
  const [masterItems, setMasterItems] = useState<InspectItemMasterRow[]>([]);
  const [selectedEquipType, setSelectedEquipType] = useState("");
  const [searchText, setSearchText] = useState("");
  const [checkedCodes, setCheckedCodes] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const inspectTypeLabel = useMemo<Record<string, string>>(() => ({
    DAILY: t("master.equipInspect.typeDaily"),
    PERIODIC: t("master.equipInspect.typePeriodic"),
    PM: t("master.equipInspect.typePM", "예방보전"),
    WORKER: t("master.equipInspect.typeWorker", "작업자점검"),
  }), [t]);

  const itemTypeLabels = useMemo<Record<string, string>>(() => ({
    VISUAL: t("master.equipInspect.itemTypeVisual", "판정형"),
    MEASURE: t("master.equipInspect.itemTypeMeasure", "측정형"),
  }), [t]);

  const cycleLabels = useMemo<Record<string, string>>(() => ({
    DAILY: t("master.equipInspect.cycleDaily"),
    WEEKLY: t("master.equipInspect.cycleWeekly"),
    MONTHLY: t("master.equipInspect.cycleMonthly"),
    QUARTERLY: t("master.equipInspect.cycleQuarterly", "분기"),
    SEMI_ANNUAL: t("master.equipInspect.cycleSemiAnnual", "반기"),
    ANNUAL: t("master.equipInspect.cycleAnnual", "연간"),
  }), [t]);

  /* ── 초기화 ── */
  useEffect(() => {
    if (!isOpen) {
      setCheckedCodes(new Set());
      setSearchText("");
      setSelectedEquipType("");
      return;
    }
    setTimeout(() => searchRef.current?.focus(), 100);
  }, [isOpen]);

  /* ── 마스터 조회 ── */
  useEffect(() => {
    if (!isOpen) return;
    setCheckedCodes(new Set());
    (async () => {
      try {
        const params: Record<string, string> = { useYn: "Y", inspectType, limit: "1000" };
        if (selectedEquipType) params.equipType = selectedEquipType;
        const res = await api.get("/master/equip-inspect-item-masters", { params });
        setMasterItems(res.data?.data ?? []);
      } catch {
        setMasterItems([]);
      }
    })();
  }, [isOpen, inspectType, selectedEquipType]);

  /* ── 검색 필터 ── */
  const filteredItems = useMemo(() => {
    if (!searchText.trim()) return masterItems;
    const s = searchText.toLowerCase();
    return masterItems.filter(
      item => item.itemCode.toLowerCase().includes(s) || item.itemName.toLowerCase().includes(s),
    );
  }, [masterItems, searchText]);

  const registeredSet = useMemo(() => new Set(registeredItemCodes), [registeredItemCodes]);

  /* ── 체크박스 토글 ── */
  const toggleCheck = useCallback((itemCode: string) => {
    setCheckedCodes(prev => {
      const next = new Set(prev);
      if (next.has(itemCode)) next.delete(itemCode);
      else next.add(itemCode);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    const selectables = filteredItems.filter(i => !registeredSet.has(i.itemCode)).map(i => i.itemCode);
    setCheckedCodes(prev => {
      const allChecked = selectables.every(c => prev.has(c));
      const next = new Set(prev);
      if (allChecked) selectables.forEach(c => next.delete(c));
      else selectables.forEach(c => next.add(c));
      return next;
    });
  }, [filteredItems, registeredSet]);

  /* ── 일괄 저장 ── */
  const handleSave = async () => {
    if (checkedCodes.size === 0) return;
    setSaving(true);
    try {
      for (const itemCode of checkedCodes) {
        await api.post("/master/equip-inspect-items", {
          equipCode,
          itemCode,
          inspectType,
          useYn: "Y",
        });
      }
      onAdded();
    } catch { /* 에러는 API 레이어에서 처리 */ }
    finally { setSaving(false); }
  };

  const selectableCount = filteredItems.filter(i => !registeredSet.has(i.itemCode)).length;
  const allChecked = selectableCount > 0 && filteredItems.filter(i => !registeredSet.has(i.itemCode)).every(i => checkedCodes.has(i.itemCode));

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* 슬라이드 패널 */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-[480px] bg-background border-l border-border shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* 헤더 */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-text">
              {t("master.equipInspect.linkItem", "점검항목 추가")}
            </h2>
            <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1.5">
              <span className="font-mono">{equipCode}</span>
              <span>{equipName}</span>
              <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                {inspectTypeLabel[inspectType] ?? inspectType}
              </span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-surface rounded-lg text-text-muted hover:text-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 필터 */}
        <div className="flex-shrink-0 px-5 py-3 border-b border-border flex gap-2">
          <div className="w-44 flex-shrink-0">
            <ComCodeSelect
              groupCode="EQUIP_TYPE"
              value={selectedEquipType}
              onChange={setSelectedEquipType}
              placeholder={t("common.all", "전체")}
              fullWidth
            />
          </div>
          <div className="flex-1">
            <Input
              ref={searchRef}
              placeholder={t("master.equipInspect.searchPlaceholder", "항목 검색...")}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              fullWidth
            />
          </div>
        </div>

        {/* 전체선택 행 */}
        {selectableCount > 0 && (
          <div className="flex-shrink-0 px-5 py-2 border-b border-border flex items-center gap-2 text-sm text-text-muted">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              className="w-4 h-4 accent-primary cursor-pointer"
            />
            <span>{t("common.selectAll", "전체 선택")} ({selectableCount})</span>
          </div>
        )}

        {/* 항목 목록 */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-sm text-text-muted">
              {t("master.equipInspect.noPoolForType", "등록된 점검항목 마스터가 없습니다")}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filteredItems.map(item => {
                const isRegistered = registeredSet.has(item.itemCode);
                const isChecked = checkedCodes.has(item.itemCode);
                return (
                  <li
                    key={item.itemCode}
                    onClick={() => !isRegistered && toggleCheck(item.itemCode)}
                    className={`flex items-start gap-3 px-5 py-3 transition-colors ${
                      isRegistered
                        ? "opacity-50 cursor-not-allowed"
                        : isChecked
                        ? "bg-primary/5 cursor-pointer"
                        : "hover:bg-surface cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isRegistered}
                      onChange={() => toggleCheck(item.itemCode)}
                      onClick={e => e.stopPropagation()}
                      className="mt-0.5 w-4 h-4 accent-primary flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-text-muted">{item.itemCode}</span>
                        <span className="text-sm font-medium text-text truncate">{item.itemName}</span>
                        {isRegistered && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-text-muted border border-border">
                            {t("master.equipInspect.alreadyRegistered", "등록됨")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ITEM_TYPE_COLORS[item.itemType] ?? ""}`}>
                          {itemTypeLabels[item.itemType] ?? item.itemType}
                        </span>
                        {item.cycle && (
                          <span className="text-xs text-text-muted">{cycleLabels[item.cycle] ?? item.cycle}</span>
                        )}
                        {item.equipType && (
                          <ComCodeBadge groupCode="EQUIP_TYPE" code={item.equipType} />
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-t border-border">
          <span className="text-sm text-text-muted">
            {checkedCodes.size > 0
              ? t("master.equipInspect.selectedCount", "{{count}}개 선택됨", { count: checkedCodes.size })
              : t("master.equipInspect.selectItemsGuide", "항목을 선택하세요")}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={checkedCodes.size === 0 || saving}>
              {saving
                ? t("common.saving", "저장 중...")
                : t("master.equipInspect.bulkRegister", "{{count}}개 일괄등록", { count: checkedCodes.size })}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: 타입 체크 확인**

```bash
pnpm --filter @harness/frontend exec tsc --noEmit
```

에러 0건 확인.

---

### Task 2: EquipAssignTab — 모달 → 패널 교체

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/master/equip-inspect/components/EquipAssignTab.tsx`
- Delete: `apps/frontend/src/app/(authenticated)/master/equip-inspect/components/AddInspectItemModal.tsx`

- [ ] **Step 1: import 교체**

`EquipAssignTab.tsx` 상단의 `AddInspectItemModal` import를 `InspectItemSelectPanel`로 교체한다.

```tsx
// 제거:
import AddInspectItemModal from "./AddInspectItemModal";

// 추가:
import InspectItemSelectPanel from "./InspectItemSelectPanel";
```

- [ ] **Step 2: `registeredItemCodes` 파생 추가**

`filteredItems` useMemo 바로 아래에 추가한다.

```tsx
const registeredItemCodes = useMemo(
  () => filteredItems.map(i => i.itemCode).filter((c): c is string => !!c),
  [filteredItems],
);
```

- [ ] **Step 3: JSX — 모달 → 패널 교체**

파일 하단의 `<AddInspectItemModal .../>` 블록을 아래로 교체한다.

```tsx
{/* 점검항목 일괄선택 패널 */}
{selectedEquip && (
  <InspectItemSelectPanel
    isOpen={addModalOpen}
    onClose={() => setAddModalOpen(false)}
    equipCode={selectedEquip.equipCode}
    equipName={selectedEquip.equipName}
    inspectType={activeTab}
    registeredItemCodes={registeredItemCodes}
    onAdded={handleAdded}
  />
)}
```

- [ ] **Step 4: `AddInspectItemModal.tsx` 파일 삭제**

```bash
rm "apps/frontend/src/app/(authenticated)/master/equip-inspect/components/AddInspectItemModal.tsx"
```

- [ ] **Step 5: 타입 체크**

```bash
pnpm --filter @harness/frontend exec tsc --noEmit
```

에러 0건 확인.

---

### Task 3: 구조 테스트 업데이트 및 커밋

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/master/equip-inspect/page.structure.test.mjs`

- [ ] **Step 1: 테스트 파일 업데이트**

기존 테스트를 유지하고 패널 구조 검증 테스트를 추가한다. 파일 전체를 아래로 교체한다.

```mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(__dir, 'page.tsx'), 'utf8');
const assignTabSource = readFileSync(join(__dir, 'components/EquipAssignTab.tsx'), 'utf8');
const panelSource = readFileSync(join(__dir, 'components/InspectItemSelectPanel.tsx'), 'utf8');
const panelSource2 = readFileSync(join(__dir, 'components/InspectItemPanel.tsx'), 'utf8');

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

test('EquipAssignTab uses InspectItemSelectPanel not AddInspectItemModal', () => {
  assert.match(assignTabSource, /InspectItemSelectPanel/);
  assert.doesNotMatch(assignTabSource, /AddInspectItemModal/);
});

test('EquipAssignTab passes registeredItemCodes to panel', () => {
  assert.match(assignTabSource, /registeredItemCodes/);
});

test('InspectItemSelectPanel has checkbox multi-select and bulk save', () => {
  assert.match(panelSource, /checkedCodes/);
  assert.match(panelSource, /toggleAll/);
  assert.match(panelSource, /handleSave/);
});

test('InspectItemSelectPanel shows registered items as disabled', () => {
  assert.match(panelSource, /registeredSet/);
  assert.match(panelSource, /isRegistered/);
  assert.match(panelSource, /disabled/);
});

test('InspectItemPanel does not have inspectType column', () => {
  assert.doesNotMatch(panelSource2, /accessorKey.*inspectType/);
  assert.doesNotMatch(panelSource2, /INSPECT_TYPE_COLORS/);
});
```

- [ ] **Step 2: 테스트 실행**

```bash
node --test "apps/frontend/src/app/(authenticated)/master/equip-inspect/page.structure.test.mjs"
```

7개 테스트 전체 PASS 확인.

- [ ] **Step 3: 커밋**

```bash
git add apps/frontend/src/app/(authenticated)/master/equip-inspect/components/InspectItemSelectPanel.tsx
git add apps/frontend/src/app/(authenticated)/master/equip-inspect/components/EquipAssignTab.tsx
git add apps/frontend/src/app/(authenticated)/master/equip-inspect/page.structure.test.mjs
git rm apps/frontend/src/app/(authenticated)/master/equip-inspect/components/AddInspectItemModal.tsx
git commit -m "feat(equip-inspect): 점검항목 단건 모달 → 우측 슬라이드 패널 + 일괄선택 등록"
```
