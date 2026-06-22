# 자유입력 필드 → 마스터 참조 컴포넌트 교체

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 자유입력(Input) 필드를 공유 Select/Modal 컴포넌트로 교체하여 마스터 데이터 정합성 보장

**Architecture:** 기존 공유 컴포넌트(PartnerSelect, ProcessSelect, LineSelect, PartSearchModal) 활용. 품목 선택은 PartSearchModal(모달+DataGrid), 나머지는 Select 드롭다운. 작업지시(orderNo)는 기존 컴포넌트 없으므로 신규 생성.

**Tech Stack:** React, TypeScript, i18next, 기존 공유 컴포넌트

---

## File Structure

| 파일 | 역할 | 변경 |
|------|------|------|
| `apps/frontend/src/app/(authenticated)/material/po/page.tsx` | PO 관리 | `partnerName` Input → PartnerSelect |
| `apps/frontend/src/app/(authenticated)/master/bom/components/BomFormModal.tsx` | BOM 폼 | `processCode` Input → ProcessSelect |
| `apps/frontend/src/app/(authenticated)/master/warehouse/components/WarehouseForm.tsx` | 창고 폼 | `lineCode` Input → LineSelect, `processCode` Input → ProcessSelect |
| `apps/frontend/src/app/(authenticated)/quality/capa/components/CapaFormPanel.tsx` | CAPA 폼 | `itemCode` Input → PartSearchModal 트리거 |
| `apps/frontend/src/app/(authenticated)/quality/fai/components/FaiFormPanel.tsx` | FAI 폼 | `itemCode` → PartSearchModal, `orderNo` → OrderSearchModal |
| `apps/frontend/src/components/shared/OrderSearchModal.tsx` | 신규 생성 | 작업지시 검색 모달 (PartSearchModal 패턴 복제) |
| `apps/frontend/src/components/shared/index.ts` | barrel export | OrderSearchModal 추가 |

---

### Task 1: PO 페이지 — partnerName → PartnerSelect

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/material/po/page.tsx`

- [ ] **Step 1: import 추가**

```tsx
// 기존 import에 PartnerSelect 추가
import { ComCodeSelect, PartnerSelect } from "@/components/shared";
```

- [ ] **Step 2: form 상태에서 partnerName → partnerId 변경**

`page.tsx:69-71` 변경:
```tsx
const [form, setForm] = useState({
  poNo: "", partnerId: "", orderDate: "", dueDate: "", remark: "",
});
```

- [ ] **Step 3: openCreate 초기화 변경**

`page.tsx:108` 변경:
```tsx
setForm({ poNo: "", partnerId: "", orderDate: "", dueDate: "", remark: "" });
```

- [ ] **Step 4: openEdit에서 partnerId 세팅**

`page.tsx:114-116` 변경:
```tsx
setForm({
  poNo: po.poNo, partnerId: po.partnerId || "",
  orderDate: po.orderDate, dueDate: po.dueDate, remark: po.remark || "",
});
```

- [ ] **Step 5: handleSave 검증 변경**

`page.tsx:122` 변경:
```tsx
if (!form.poNo || !form.partnerId) return;
```

- [ ] **Step 6: PurchaseOrder 인터페이스에 partnerId 추가**

`page.tsx:38-47` 변경:
```tsx
interface PurchaseOrder {
  poNo: string;
  partnerId: string;
  partnerName: string;  // JOIN 결과로 받는 표시용 (읽기전용)
  orderDate: string;
  dueDate: string;
  status: string;
  totalAmount: number | null;
  remark: string | null;
  items: PurchaseOrderItem[];
}
```

- [ ] **Step 7: 모달 폼에서 Input → PartnerSelect 교체**

`page.tsx:387-391` 변경:
```tsx
<PartnerSelect
  label={t("material.po.partnerName")}
  partnerType="SUPPLIER"
  value={form.partnerId}
  onChange={(v) => setForm(p => ({ ...p, partnerId: v }))}
  fullWidth
/>
```

- [ ] **Step 8: 저장 버튼 disabled 조건 변경**

`page.tsx:406` 변경:
```tsx
disabled={saving || !form.poNo || !form.partnerId}
```

- [ ] **Step 9: 빌드 검증**

Run: `cd C:/Project/HANES && pnpm build --filter frontend`
Expected: 에러 0건

---

### Task 2: BOM 모달 — processCode → ProcessSelect

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/master/bom/components/BomFormModal.tsx`

- [ ] **Step 1: import에 ProcessSelect 추가**

`BomFormModal.tsx:16` 변경:
```tsx
import { ComCodeSelect, ProcessSelect } from "@/components/shared";
```

- [ ] **Step 2: processCode Input → ProcessSelect 교체**

`BomFormModal.tsx:143` 변경:
```tsx
<ProcessSelect
  label={t("master.bom.processCode", "공정코드")}
  value={processCode}
  onChange={(v) => setProcessCode(v)}
  fullWidth
/>
```

- [ ] **Step 3: 빌드 검증**

Run: `cd C:/Project/HANES && pnpm build --filter frontend`
Expected: 에러 0건

---

### Task 3: 창고 폼 — lineCode → LineSelect, processCode → ProcessSelect

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/master/warehouse/components/WarehouseForm.tsx`

- [ ] **Step 1: import 변경**

`WarehouseForm.tsx:6` 변경:
```tsx
import { Button, Input, Modal, Select } from '@/components/ui';
import { LineSelect, ProcessSelect } from '@/components/shared';
```

- [ ] **Step 2: lineCode Input → LineSelect 교체**

`WarehouseForm.tsx:48-51` 변경:
```tsx
<div>
  <LineSelect
    label={t('inventory.warehouse.lineCode')}
    value={formData.lineCode}
    onChange={(v) => onChange({ ...formData, lineCode: v })}
    fullWidth
  />
</div>
```

- [ ] **Step 3: processCode Input → ProcessSelect 교체**

`WarehouseForm.tsx:52-55` 변경:
```tsx
<div>
  <ProcessSelect
    label={t('inventory.warehouse.processCode')}
    value={formData.processCode}
    onChange={(v) => onChange({ ...formData, processCode: v })}
    fullWidth
  />
</div>
```

- [ ] **Step 4: 빌드 검증**

Run: `cd C:/Project/HANES && pnpm build --filter frontend`
Expected: 에러 0건

---

### Task 4: CAPA 패널 — itemCode → PartSearchModal

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/quality/capa/components/CapaFormPanel.tsx`

- [ ] **Step 1: import 추가**

`CapaFormPanel.tsx:15-16` 변경:
```tsx
import { Button, Input } from "@/components/ui";
import { LineSelect, ComCodeSelect, WorkerSelect } from "@/components/shared";
import PartSearchModal from "@/components/shared/PartSearchModal";
import type { PartItem } from "@/components/shared/PartSearchModal";
```

- [ ] **Step 2: 모달 open 상태 추가**

`CapaFormPanel.tsx:46` 아래 추가:
```tsx
const [partModalOpen, setPartModalOpen] = useState(false);
```

- [ ] **Step 3: itemCode Input → 검색 버튼 + 읽기전용 Input 교체**

`CapaFormPanel.tsx:149-150` (품목코드 영역) 변경:
```tsx
<div>
  <label className="block text-xs font-medium text-text mb-1">
    {t("quality.capa.itemCode")}
  </label>
  <div className="flex gap-1">
    <Input value={form.itemCode} readOnly fullWidth
      placeholder={t("common.partSearchPlaceholder", "품목 검색...")}
      onClick={() => setPartModalOpen(true)}
      className="cursor-pointer" />
    <Button size="sm" variant="secondary" onClick={() => setPartModalOpen(true)}>
      <Search className="w-3 h-3" />
    </Button>
  </div>
</div>
```

- [ ] **Step 4: Search 아이콘 import 추가**

`CapaFormPanel.tsx:14` 변경:
```tsx
import { X, Search } from "lucide-react";
```

- [ ] **Step 5: PartSearchModal 렌더링 추가**

`CapaFormPanel.tsx` 닫는 `</div>` 직전에 추가:
```tsx
<PartSearchModal
  isOpen={partModalOpen}
  onClose={() => setPartModalOpen(false)}
  onSelect={(part: PartItem) => setField("itemCode", part.itemCode)}
/>
```

- [ ] **Step 6: 빌드 검증**

Run: `cd C:/Project/HANES && pnpm build --filter frontend`
Expected: 에러 0건

---

### Task 5: OrderSearchModal 신규 생성

**Files:**
- Create: `apps/frontend/src/components/shared/OrderSearchModal.tsx`
- Modify: `apps/frontend/src/components/shared/index.ts`

- [ ] **Step 1: OrderSearchModal 컴포넌트 생성**

PartSearchModal과 동일 패턴으로 작업지시(JobOrder) 검색 모달 생성:

```tsx
/**
 * @file src/components/shared/OrderSearchModal.tsx
 * @description 작업지시 검색 모달 — 검색 + DataGrid 기반
 *
 * 초보자 가이드:
 * 1. 작업지시번호를 검색하고 선택할 수 있는 공통 모달
 * 2. onSelect: 행 클릭 시 선택된 작업지시 정보를 부모에 전달
 * 3. 검색어 입력 → Enter 또는 검색 버튼 → API 호출 → DataGrid 표시
 */
"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Modal, Button, Input } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";

export interface OrderItem {
  orderNo: string;
  itemCode: string;
  itemName: string;
  orderQty: number;
  status: string;
}

interface OrderSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (order: OrderItem) => void;
}

export default function OrderSearchModal({
  isOpen,
  onClose,
  onSelect,
}: OrderSearchModalProps) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const [data, setData] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setKeyword("");
    fetchOrders("");
  }, [isOpen]);

  const fetchOrders = useCallback(async (search: string) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 200 };
      if (search.trim()) params.search = search.trim();
      const res = await api.get("/production/job-orders", { params });
      const raw = res.data?.data;
      setData(Array.isArray(raw) ? raw : raw?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(() => {
    fetchOrders(keyword);
  }, [fetchOrders, keyword]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSearch();
    },
    [handleSearch]
  );

  const handleRowClick = useCallback(
    (row: OrderItem) => {
      onSelect(row);
      onClose();
    },
    [onSelect, onClose]
  );

  const columns = useMemo<ColumnDef<OrderItem, unknown>[]>(
    () => [
      { accessorKey: "orderNo", header: t("production.jobOrder.orderNo", "작업지시번호"), size: 180 },
      { accessorKey: "itemCode", header: t("common.partCode"), size: 140 },
      { accessorKey: "itemName", header: t("common.partName"), size: 200 },
      { accessorKey: "orderQty", header: t("production.jobOrder.orderQty", "지시수량"), size: 100 },
      { accessorKey: "status", header: t("common.status"), size: 100 },
    ],
    [t]
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose}
      title={t("quality.fai.orderSearch", "작업지시 검색")} size="xl">
      <div className="flex items-end gap-2 mb-3">
        <Input
          placeholder={t("quality.fai.orderSearchPlaceholder", "작업지시번호 또는 품목 검색...")}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
          leftIcon={<Search className="w-4 h-4" />}
          fullWidth
        />
        <Button onClick={handleSearch} className="flex-shrink-0">
          {t("common.search")}
        </Button>
      </div>
      <DataGrid
        data={data}
        columns={columns}
        isLoading={loading}
        onRowClick={handleRowClick}
        pageSize={10}
        enableColumnFilter={false}
        enableColumnReordering={false}
        maxHeight="400px"
      />
    </Modal>
  );
}
```

- [ ] **Step 2: barrel export에 추가**

`apps/frontend/src/components/shared/index.ts`에 추가:
```tsx
export { default as OrderSearchModal } from "./OrderSearchModal";
export type { OrderItem } from "./OrderSearchModal";
```

- [ ] **Step 3: 빌드 검증**

Run: `cd C:/Project/HANES && pnpm build --filter frontend`
Expected: 에러 0건

---

### Task 6: FAI 패널 — itemCode → PartSearchModal, orderNo → OrderSearchModal

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/quality/fai/components/FaiFormPanel.tsx`

- [ ] **Step 1: import 추가**

`FaiFormPanel.tsx:16-17` 변경:
```tsx
import { Button, Input } from "@/components/ui";
import { LineSelect, ComCodeSelect, WorkerSelect } from "@/components/shared";
import PartSearchModal from "@/components/shared/PartSearchModal";
import type { PartItem } from "@/components/shared/PartSearchModal";
import OrderSearchModal from "@/components/shared/OrderSearchModal";
import type { OrderItem } from "@/components/shared/OrderSearchModal";
```

- [ ] **Step 2: 모달 open 상태 추가**

`FaiFormPanel.tsx:62` 아래 추가:
```tsx
const [partModalOpen, setPartModalOpen] = useState(false);
const [orderModalOpen, setOrderModalOpen] = useState(false);
```

- [ ] **Step 3: Search 아이콘 import 추가**

`FaiFormPanel.tsx:15` 변경 — lucide-react에서 Search 추가:
```tsx
import { X, Search } from "lucide-react";
```

- [ ] **Step 4: itemCode Input → 검색 버튼 + 읽기전용 Input**

`FaiFormPanel.tsx:140-141` 변경:
```tsx
<div>
  <label className="block text-xs font-medium text-text mb-1">
    {t("common.code") + " *"}
  </label>
  <div className="flex gap-1">
    <Input value={form.itemCode} readOnly fullWidth
      placeholder={t("common.partSearchPlaceholder", "품목 검색...")}
      onClick={() => setPartModalOpen(true)}
      className="cursor-pointer" />
    <Button size="sm" variant="secondary" onClick={() => setPartModalOpen(true)}>
      <Search className="w-3 h-3" />
    </Button>
  </div>
</div>
```

- [ ] **Step 5: orderNo Input → 검색 버튼 + 읽기전용 Input**

`FaiFormPanel.tsx:149-150` 변경:
```tsx
<div>
  <label className="block text-xs font-medium text-text mb-1">
    {t("quality.fai.orderNo", "작업지시")}
  </label>
  <div className="flex gap-1">
    <Input value={form.orderNo} readOnly fullWidth
      placeholder={t("quality.fai.orderSearchPlaceholder", "작업지시 검색...")}
      onClick={() => setOrderModalOpen(true)}
      className="cursor-pointer" />
    <Button size="sm" variant="secondary" onClick={() => setOrderModalOpen(true)}>
      <Search className="w-3 h-3" />
    </Button>
  </div>
</div>
```

- [ ] **Step 6: 모달 컴포넌트 렌더링 추가**

`FaiFormPanel.tsx` 닫는 `</div>` 직전에 추가:
```tsx
<PartSearchModal
  isOpen={partModalOpen}
  onClose={() => setPartModalOpen(false)}
  onSelect={(part: PartItem) => setField("itemCode", part.itemCode)}
/>
<OrderSearchModal
  isOpen={orderModalOpen}
  onClose={() => setOrderModalOpen(false)}
  onSelect={(order: OrderItem) => setField("orderNo", order.orderNo)}
/>
```

- [ ] **Step 7: 빌드 검증**

Run: `cd C:/Project/HANES && pnpm build --filter frontend`
Expected: 에러 0건

---

### Task 7: 최종 빌드 검증 + i18n 키 확인

- [ ] **Step 1: 전체 빌드**

Run: `cd C:/Project/HANES && pnpm build --filter frontend`
Expected: 에러 0건

- [ ] **Step 2: 신규 i18n 키 확인**

OrderSearchModal에서 사용한 신규 키:
- `quality.fai.orderSearch` → "작업지시 검색"
- `quality.fai.orderSearchPlaceholder` → "작업지시번호 또는 품목 검색..."

모든 i18n 파일(ko, en, zh, vi) 4개에 추가 필요.

- [ ] **Step 3: 커밋**

```bash
git add apps/frontend/src/app/(authenticated)/material/po/page.tsx \
  apps/frontend/src/app/(authenticated)/master/bom/components/BomFormModal.tsx \
  apps/frontend/src/app/(authenticated)/master/warehouse/components/WarehouseForm.tsx \
  apps/frontend/src/app/(authenticated)/quality/capa/components/CapaFormPanel.tsx \
  apps/frontend/src/app/(authenticated)/quality/fai/components/FaiFormPanel.tsx \
  apps/frontend/src/components/shared/OrderSearchModal.tsx \
  apps/frontend/src/components/shared/index.ts
git commit -m "refactor(ui): 자유입력 필드를 마스터 참조 컴포넌트로 교체

- PO: partnerName Input → PartnerSelect (partnerId 저장)
- BOM: processCode Input → ProcessSelect
- Warehouse: lineCode → LineSelect, processCode → ProcessSelect
- CAPA: itemCode Input → PartSearchModal
- FAI: itemCode → PartSearchModal, orderNo → OrderSearchModal (신규)
"
```
