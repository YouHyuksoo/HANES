"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Boxes, CalendarDays, CheckCircle2, ClipboardList, Package, Search, Settings2 } from "lucide-react";
import toast from "react-hot-toast";
import { Badge, Button, Input, Modal, Select } from "@/components/ui";
import { LineSelect, PartSearchModal, QtyInput } from "@/components/shared";
import { useProcessEquipmentOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";
import type { BadgeVariant } from "@/components/ui";
import type { JobOrderFormData } from "./JobOrderFormPanel";

interface RoutingProcessInfo {
  seq: number;
  processCode: string;
  processName: string;
  equipType?: string | null;
  jobOrderYn?: string | null;
}

interface RoutingInfo {
  routingCode: string;
  routingName: string;
  processes: RoutingProcessInfo[];
}

interface BomTreeItem {
  id?: string;
  parentItemCode?: string;
  childItemCode?: string;
  itemCode: string;
  itemName?: string | null;
  itemType?: string | null;
  qtyPer?: number | string | null;
  processCode?: string | null;
  processName?: string | null;
  children?: BomTreeItem[];
  isRoot?: boolean;
}

interface GeneratedJobOrderPreviewRow {
  key: string;
  orderKind: "ITEM" | "OPERATION";
  depth: number;
  itemCode: string;
  itemName?: string | null;
  itemType?: string | null;
  routingCode?: string | null;
  routingName?: string | null;
  routingSeq?: number;
  processCode?: string;
  processName?: string;
  equipType?: string | null;
}

interface Props {
  isOpen: boolean;
  draftOrder?: Partial<JobOrderFormData>;
  onClose: () => void;
  onSave: () => void;
}

interface OperationEquipmentSelectProps {
  process: RoutingProcessInfo;
  value: string;
  onChange: (value: string) => void;
}

interface BomTreeRowsProps {
  items: BomTreeItem[];
  path?: string[];
  selectedItemCode?: string;
  onSelectItem: (itemCode: string) => void;
  getItemTypeLabel: (itemType?: string | null) => string;
  getItemTypeVariant: (itemType?: string | null) => BadgeVariant;
}

const INIT_FORM = {
  itemCode: "",
  planQty: "",
  planDate: "",
  lineCode: "",
  custPoNo: "",
  priority: "5",
  remark: "",
};

function countBomNodes(items: BomTreeItem[]): number {
  return items.reduce((sum, item) => sum + 1 + countBomNodes(item.children ?? []), 0);
}

function countSemiProductNodes(items: BomTreeItem[]): number {
  return items.reduce((sum, item) => {
    const self = !item.isRoot && item.itemType === "SEMI_PRODUCT" ? 1 : 0;
    return sum + self + countSemiProductNodes(item.children ?? []);
  }, 0);
}

function collectRoutableBomItems(items: BomTreeItem[], result: BomTreeItem[] = [], seen = new Set<string>()): BomTreeItem[] {
  for (const item of items) {
    const shouldCreateItemOrder = item.isRoot || item.itemType === "SEMI_PRODUCT";
    if (shouldCreateItemOrder && !seen.has(item.itemCode)) {
      seen.add(item.itemCode);
      result.push(item);
    }
    collectRoutableBomItems(item.children ?? [], result, seen);
  }
  return result;
}

function collectGeneratedJobOrderRows(
  items: BomTreeItem[],
  routingInfoByItem: Record<string, RoutingInfo | null>,
  depth = 0,
): GeneratedJobOrderPreviewRow[] {
  const rows: GeneratedJobOrderPreviewRow[] = [];
  for (const item of items) {
    const shouldCreateItemOrder = item.isRoot || item.itemType === "SEMI_PRODUCT";
    const routing = routingInfoByItem[item.itemCode] ?? null;
    if (shouldCreateItemOrder) {
      rows.push({
        key: `ITEM::${item.itemCode}`,
        orderKind: "ITEM",
        depth,
        itemCode: item.itemCode,
        itemName: item.itemName,
        itemType: item.itemType,
        routingCode: routing?.routingCode ?? null,
        routingName: routing?.routingName ?? null,
      });
      if (routing) {
        const routingProcesses = routing.processes.filter((proc) => (proc.jobOrderYn ?? "Y") === "Y");
        for (const process of routingProcesses) {
          rows.push({
            key: `OPERATION::${item.itemCode}::${routing.routingCode}::${process.seq}::${process.processCode}`,
            orderKind: "OPERATION",
            depth: depth + 1,
            itemCode: item.itemCode,
            itemName: item.itemName,
            itemType: item.itemType,
            routingCode: routing.routingCode,
            routingName: routing.routingName,
            routingSeq: process.seq,
            processCode: process.processCode,
            processName: process.processName,
            equipType: process.equipType,
          });
        }
      }
    }
    rows.push(...collectGeneratedJobOrderRows(item.children ?? [], routingInfoByItem, depth + 1));
  }
  return rows;
}

function OperationEquipmentSelect({ process, value, onChange }: OperationEquipmentSelectProps) {
  const { t } = useTranslation();
  const { options, isLoading } = useProcessEquipmentOptions(
    process.processCode,
    process.equipType ?? undefined,
    true,
  );

  const selectOptions = useMemo(
    () => [
      { value: "", label: t("production.order.equipUnassignedAllowed", "미지정 허용") },
      ...options,
    ],
    [options, t],
  );

  return (
    <Select
      value={value}
      onChange={onChange}
      options={selectOptions}
      disabled={isLoading}
      className="h-9 text-xs"
      fullWidth
    />
  );
}

function BomTreeRows({
  items,
  path = [],
  selectedItemCode,
  onSelectItem,
  getItemTypeLabel,
  getItemTypeVariant,
}: BomTreeRowsProps) {
  return (
    <>
      {items.map((item, index) => {
        const key = item.id ?? `${item.parentItemCode ?? "ROOT"}-${item.itemCode}-${index}`;
        const hasChildren = !!item.children?.length;
        const isSelected = item.itemCode === selectedItemCode;
        const levelDots = ".".repeat(path.length);
        const nextPath = [...path, item.itemCode];
        return (
          <div key={key}>
            <button
              type="button"
              onClick={() => onSelectItem(item.itemCode)}
              className={`grid w-full grid-cols-[minmax(210px,1fr)_88px_88px_minmax(110px,0.8fr)] items-center gap-3 border-b border-border px-3 py-2 text-left text-xs transition-colors last:border-b-0 hover:bg-primary/5 ${isSelected ? "bg-primary/10 ring-1 ring-inset ring-primary/40" : ""}`}
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  {hasChildren ? <Boxes className="h-3.5 w-3.5 flex-shrink-0 text-primary" /> : <Package className="h-3.5 w-3.5 flex-shrink-0 text-text-muted" />}
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1 font-medium text-text">
                      {levelDots && <span className="font-mono text-primary/70">{levelDots}</span>}
                      <span className="truncate">{item.itemCode}</span>
                    </div>
                    <div className="truncate text-[11px] text-text-muted">{item.itemName || "-"}</div>
                  </div>
                </div>
              </div>
              <div>
                <Badge variant={getItemTypeVariant(item.itemType)}>{getItemTypeLabel(item.itemType)}</Badge>
              </div>
              <div className="text-right text-text">{item.isRoot ? "-" : (item.qtyPer ?? "-")}</div>
              <div className="truncate text-text-muted">{item.processName || item.processCode || "-"}</div>
            </button>
            {hasChildren ? (
              <BomTreeRows
                items={item.children ?? []}
                path={nextPath}
                selectedItemCode={selectedItemCode}
                onSelectItem={onSelectItem}
                getItemTypeLabel={getItemTypeLabel}
                getItemTypeVariant={getItemTypeVariant}
              />
            ) : null}
          </div>
        );
      })}
    </>
  );
}

export default function JobOrderCreateModal({ isOpen, draftOrder, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const [partSearchOpen, setPartSearchOpen] = useState(false);
  const [routingInfo, setRoutingInfo] = useState<RoutingInfo | null>(null);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [routingInfoByItem, setRoutingInfoByItem] = useState<Record<string, RoutingInfo | null>>({});
  const [generatedRoutingLoading, setGeneratedRoutingLoading] = useState(false);
  const [bomTree, setBomTree] = useState<BomTreeItem[]>([]);
  const [bomLoading, setBomLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [operationAssignments, setOperationAssignments] = useState<Record<string, string>>({});
  const [selectedBomItemCode, setSelectedBomItemCode] = useState(draftOrder?.itemCode ?? "");
  const selectedRoutingRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [form, setForm] = useState(() => ({
    ...INIT_FORM,
    itemCode: draftOrder?.itemCode ?? "",
    planQty: draftOrder?.planQty != null ? String(draftOrder.planQty) : "",
    planDate: draftOrder?.planDate ? String(draftOrder.planDate).slice(0, 10) : "",
    lineCode: draftOrder?.lineCode ?? "",
    custPoNo: draftOrder?.custPoNo ?? "",
    priority: String(draftOrder?.priority ?? "5"),
    remark: draftOrder?.remark ?? "",
  }));

  const bomTreeWithRoot = useMemo<BomTreeItem[]>(() => {
    if (!form.itemCode) return [];
    return [{
      id: `ROOT::${form.itemCode}`,
      itemCode: form.itemCode,
      itemName: form.itemCode,
      itemType: "FINISHED",
      qtyPer: 1,
      children: bomTree,
      isRoot: true,
    }];
  }, [bomTree, form.itemCode]);
  const bomItemCount = useMemo(() => countBomNodes(bomTreeWithRoot), [bomTreeWithRoot]);
  const bomSemiProductCount = useMemo(() => countSemiProductNodes(bomTreeWithRoot), [bomTreeWithRoot]);
  const routableBomItems = useMemo(() => collectRoutableBomItems(bomTreeWithRoot), [bomTreeWithRoot]);
  const routableBomItemKey = useMemo(
    () => routableBomItems.map((item) => item.itemCode).join("|"),
    [routableBomItems],
  );
  const generatedJobOrderRows = useMemo(
    () => collectGeneratedJobOrderRows(bomTreeWithRoot, routingInfoByItem),
    [bomTreeWithRoot, routingInfoByItem],
  );
  const generatedItemRows = useMemo(
    () => generatedJobOrderRows.filter((row) => row.orderKind === "ITEM"),
    [generatedJobOrderRows],
  );
  const generatedOperationRows = useMemo(
    () => generatedJobOrderRows.filter((row) => row.orderKind === "OPERATION"),
    [generatedJobOrderRows],
  );

  const fetchRouting = useCallback(async (itemCode: string) => {
    if (!itemCode) {
      setRoutingInfo(null);
      return;
    }
    setRoutingLoading(true);
    try {
      const res = await api.get(`/master/routing-groups/by-item/${itemCode}`);
      const data = res.data?.data || null;
      setRoutingInfo(data);
      setRoutingInfoByItem((prev) => ({ ...prev, [itemCode]: data }));
      setOperationAssignments({});
    } catch {
      setRoutingInfo(null);
      setRoutingInfoByItem((prev) => ({ ...prev, [itemCode]: null }));
      setOperationAssignments({});
    } finally {
      setRoutingLoading(false);
    }
  }, []);

  const fetchBomTree = useCallback(async (itemCode: string, effectiveDate?: string) => {
    if (!itemCode) {
      setBomTree([]);
      return;
    }
    setBomLoading(true);
    try {
      const params: Record<string, string | number> = { depth: 10 };
      if (effectiveDate) params.effectiveDate = effectiveDate;
      const res = await api.get(`/master/boms/hierarchy/${encodeURIComponent(itemCode)}`, { params });
      setBomTree(res.data?.data || []);
    } catch {
      setBomTree([]);
    } finally {
      setBomLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const nextForm = {
      ...INIT_FORM,
      itemCode: draftOrder?.itemCode ?? "",
      planQty: draftOrder?.planQty != null ? String(draftOrder.planQty) : "",
      planDate: draftOrder?.planDate ? String(draftOrder.planDate).slice(0, 10) : "",
      lineCode: draftOrder?.lineCode ?? "",
      custPoNo: draftOrder?.custPoNo ?? "",
      priority: String(draftOrder?.priority ?? "5"),
      remark: draftOrder?.remark ?? "",
    };
    setForm(nextForm);
    setOperationAssignments({});
    setSelectedBomItemCode(nextForm.itemCode);
    if (nextForm.itemCode) {
      fetchRouting(nextForm.itemCode);
      fetchBomTree(nextForm.itemCode, nextForm.planDate);
    } else {
      setRoutingInfo(null);
      setRoutingInfoByItem({});
      setBomTree([]);
    }
  }, [isOpen, draftOrder, fetchBomTree, fetchRouting]);

  const setField = useCallback((key: keyof typeof INIT_FORM, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    if (!isOpen || !form.itemCode) return;
    fetchBomTree(form.itemCode, form.planDate);
  }, [fetchBomTree, form.itemCode, form.planDate, isOpen]);

  useEffect(() => {
    if (!isOpen || routableBomItems.length === 0) return;
    let canceled = false;
    setGeneratedRoutingLoading(true);
    Promise.all(
      routableBomItems.map(async (item) => {
        try {
          const res = await api.get(`/master/routing-groups/by-item/${item.itemCode}`);
          return [item.itemCode, res.data?.data || null] as const;
        } catch {
          return [item.itemCode, null] as const;
        }
      }),
    ).then((entries) => {
      if (canceled) return;
      const nextMap = Object.fromEntries(entries);
      setRoutingInfoByItem(nextMap);
      setRoutingInfo(nextMap[form.itemCode] ?? null);
      setOperationAssignments({});
    }).finally(() => {
      if (!canceled) setGeneratedRoutingLoading(false);
    });
    return () => {
      canceled = true;
    };
  }, [form.itemCode, isOpen, routableBomItemKey, routableBomItems]);

  const setOperationEquip = useCallback((key: string, equipCode: string) => {
    setOperationAssignments((prev) => ({ ...prev, [key]: equipCode }));
  }, []);

  const getItemTypeLabel = useCallback((itemType?: string | null) => {
    const labels: Record<string, string> = {
      FINISHED: t("common.finishedProduct", "완제품"),
      SEMI_PRODUCT: t("common.semiProduct", "반제품"),
      MATERIAL: t("common.rawMaterial", "원자재"),
      RAW_MATERIAL: t("common.rawMaterial", "원자재"),
    };
    return itemType ? (labels[itemType] ?? itemType) : "-";
  }, [t]);

  const getItemTypeVariant = useCallback((itemType?: string | null): BadgeVariant => {
    const variants: Record<string, BadgeVariant> = {
      FINISHED: "success",
      SEMI_PRODUCT: "info",
      MATERIAL: "warning",
      RAW_MATERIAL: "warning",
    };
    return itemType ? (variants[itemType] ?? "neutral") : "neutral";
  }, []);

  useEffect(() => {
    if (!selectedBomItemCode) return;
    const targetRow = generatedJobOrderRows.find((row) => row.itemCode === selectedBomItemCode);
    if (!targetRow) return;
    window.requestAnimationFrame(() => {
      selectedRoutingRowRefs.current[targetRow.key]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [generatedJobOrderRows, selectedBomItemCode]);

  const handleSubmit = useCallback(async () => {
    if (!form.itemCode || !form.planQty || !form.planDate || !routingInfo) return;
    setSaving(true);
    try {
      const payload = {
        itemCode: form.itemCode,
        planQty: Number(form.planQty),
        planDate: form.planDate,
        lineCode: form.lineCode || undefined,
        custPoNo: form.custPoNo || undefined,
        priority: Number(form.priority),
        remark: form.remark || undefined,
        operationAssignments: generatedOperationRows.map((row) => ({
          itemCode: row.itemCode,
          routingCode: row.routingCode || undefined,
          routingSeq: row.routingSeq,
          processCode: row.processCode,
          equipCode: operationAssignments[row.key] || undefined,
        })),
      };
      await api.post("/production/job-orders", payload);
      toast.success(t("production.order.createSuccess", "작업지시를 생성했습니다."));
      onSave();
      onClose();
    } catch {
      // api 인터셉터에서 처리
    } finally {
      setSaving(false);
    }
  }, [form, routingInfo, generatedOperationRows, operationAssignments, onClose, onSave, t]);

  const canSave = !!form.itemCode && !!form.planQty && !!form.planDate && !!routingInfo && !generatedRoutingLoading;
  const assignedCount = generatedOperationRows.filter((row) => operationAssignments[row.key]).length;
  const selectedGeneratedCount = selectedBomItemCode
    ? generatedJobOrderRows.filter((row) => row.itemCode === selectedBomItemCode).length
    : 0;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t("production.order.createTitle", "작업지시 생성")}
        size="full"
        closeOnOverlayClick={false}
        footer={(
          <>
            <div className="mr-auto text-xs text-text-muted">
              {t("production.order.operationEquipProgress", "공정 설비 {{done}}/{{total}} 지정", {
                done: assignedCount,
                total: generatedOperationRows.length,
              })}
            </div>
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={!canSave} isLoading={saving}>
              {t("production.order.create", "작업지시 생성")}
            </Button>
          </>
        )}
      >
        <div className="grid min-h-[62vh] grid-cols-[300px_minmax(0,1fr)] gap-3">
          <section className="space-y-3 border-r border-border pr-3">
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
                <ClipboardList className="h-4 w-4 text-primary" />
                {t("production.order.sectionBasic", "기본정보")}
              </h3>
              <div className="space-y-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text">{t("common.partName")}</label>
                  <div className="flex gap-1">
                    <Input value={form.itemCode} readOnly placeholder={t("common.partSearchPlaceholder")} fullWidth />
                    <button
                      type="button"
                      onClick={() => setPartSearchOpen(true)}
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--radius)] border border-border bg-surface text-text-muted transition-colors hover:bg-primary/10 hover:text-primary"
                      title={t("common.partSearch")}
                    >
                      <Search className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <QtyInput label={t("production.order.planQty")} value={Number(form.planQty) || 0}
                  onChange={(n) => setField("planQty", n ? String(n) : "")} fullWidth />
                <Input label={`${t("production.order.planDate")} *`} type="date" value={form.planDate}
                  onChange={(e) => setField("planDate", e.target.value)} fullWidth />
                <LineSelect label={t("production.order.line")} value={form.lineCode}
                  onChange={(v) => setField("lineCode", v)} fullWidth />
                <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
                  <Input label={t("production.order.priority")} type="number" value={form.priority}
                    onChange={(e) => setField("priority", e.target.value)} fullWidth />
                  <Input label={t("production.order.custPoNo")} value={form.custPoNo}
                    onChange={(e) => setField("custPoNo", e.target.value)} placeholder="PO-2026-0001" fullWidth />
                </div>
                <Input label={t("common.remark")} value={form.remark}
                  onChange={(e) => setField("remark", e.target.value)} fullWidth />
              </div>
            </div>
          </section>

          <section className="min-w-0 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
                    <Settings2 className="h-4 w-4 text-primary" />
                    {t("production.order.createPreview", "생성될 작업지시")}
                  </h3>
                  <div className="flex items-center gap-1">
                    <span className="rounded border border-border bg-surface px-2 py-1 text-[11px] text-text-muted">
                      {t("production.order.itemOrder", "품목지시")} <b className="text-text">{generatedItemRows.length || (form.itemCode ? 1 : 0)}</b>
                    </span>
                    <span className="rounded border border-border bg-surface px-2 py-1 text-[11px] text-text-muted">
                      {t("production.order.operationOrder", "공정지시")} <b className="text-text">{generatedOperationRows.length}</b>
                    </span>
                    <span className="rounded border border-border bg-surface px-2 py-1 text-[11px] text-text-muted">
                      {t("production.order.assignedEquip", "설비지정")} <b className="text-text">{assignedCount}</b>
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {t("production.order.createPreviewDesc", "저장 전에 공정지시별 설비를 지정합니다. 미지정도 허용됩니다.")}
                </p>
              </div>
              {routingInfo && (
                <div className="rounded border border-border bg-surface px-3 py-2 text-right text-xs">
                  <div className="font-semibold text-text">{routingInfo.routingCode}</div>
                  <div className="text-text-muted">{routingInfo.routingName}</div>
                </div>
              )}
            </div>

            <div className="grid min-h-0 grid-cols-[minmax(360px,0.95fr)_minmax(520px,1.25fr)] gap-3">
              <section className="min-w-0 overflow-hidden rounded border border-border">
                <div className="flex items-center justify-between border-b border-border bg-background px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-text">
                      {t("production.order.bomPreview", "BOM 전개")}
                    </div>
                    <div className="truncate text-[11px] text-text-muted">
                      {t("production.order.bomPreviewDesc", "저장 시 반제품 작업지시는 BOM 계층 기준으로 자동 생성됩니다.")}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right text-[11px] text-text-muted">
                    <div>{t("production.order.bomItemCount", "표시 {{count}}건", { count: bomItemCount })}</div>
                    <div>{t("production.order.bomSemiProductCount", "반제품 {{count}}건", { count: bomSemiProductCount })}</div>
                  </div>
                </div>
                <div className="grid grid-cols-[minmax(210px,1fr)_88px_88px_minmax(110px,0.8fr)] gap-3 border-b border-border bg-surface px-3 py-2 text-xs font-semibold text-text-muted">
                  <div>{t("common.part", "품목")}</div>
                  <div>{t("common.itemType", "품목유형")}</div>
                  <div className="text-right">{t("production.order.bomQty", "BOM수량")}</div>
                  <div>{t("production.order.process", "공정")}</div>
                </div>
                <div className="max-h-[46vh] overflow-y-auto">
                  {bomLoading ? (
                    <div className="px-3 py-6 text-center text-sm text-text-muted">{t("common.loading")}</div>
                  ) : form.itemCode ? (
                    <BomTreeRows
                      items={bomTreeWithRoot}
                      selectedItemCode={selectedBomItemCode}
                      onSelectItem={setSelectedBomItemCode}
                      getItemTypeLabel={getItemTypeLabel}
                      getItemTypeVariant={getItemTypeVariant}
                    />
                  ) : (
                    <div className="px-3 py-6 text-center text-sm text-text-muted">
                      {t("production.order.selectPartForBom", "품목을 선택하면 BOM 계층이 펼쳐집니다.")}
                    </div>
                  )}
                </div>
              </section>

              <section className="min-w-0 overflow-hidden rounded border border-border">
                <div className="flex items-center justify-between border-b border-border bg-background px-3 py-2">
                  <div>
                    <div className="text-xs font-semibold text-text">
                      {t("production.order.routingPreview", "라우팅 표시")}
                    </div>
                    <div className="text-[11px] text-text-muted">
                      {t("production.order.routingPreviewDesc", "작업지시로 생성될 공정과 공정별 설비 배정을 표시합니다.")}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-text-muted">
                    <div>{t("production.order.operationOrderCount", "공정지시 {{count}}건", { count: generatedOperationRows.length })}</div>
                    <div>{t("production.order.selectedItem", "선택 {{itemCode}} · {{count}}건", {
                      itemCode: selectedBomItemCode || "-",
                      count: selectedGeneratedCount,
                    })}</div>
                    <div>{t("production.order.assignedEquipCount", "설비지정 {{count}}건", { count: assignedCount })}</div>
                  </div>
                </div>
                <div className="grid grid-cols-[82px_56px_minmax(150px,1fr)_minmax(130px,1fr)_minmax(190px,280px)_78px] border-b border-border bg-surface px-3 py-2 text-xs font-semibold text-text-muted">
                  <div>{t("common.type", "구분")}</div>
                  <div>{t("common.sequence", "순번")}</div>
                  <div>{t("common.part", "품목")}</div>
                  <div>{t("production.order.process", "공정")}</div>
                  <div>{t("production.order.equip", "설비")}</div>
                  <div>{t("common.status", "상태")}</div>
                </div>
                <div className="max-h-[46vh] overflow-y-auto">
                  {(routingLoading || generatedRoutingLoading) && (
                    <div className="px-3 py-8 text-center text-sm text-text-muted">{t("common.loading")}</div>
                  )}
                  {!routingLoading && !generatedRoutingLoading && !routingInfo && (
                    <div className="px-3 py-8 text-center text-sm text-text-muted">
                      {t("production.order.selectPartForRouting", "품목을 선택하면 라우팅 공정지시가 펼쳐집니다.")}
                    </div>
                  )}
                  {!routingLoading && !generatedRoutingLoading && generatedJobOrderRows.map((row) => {
                    const isSelectedRow = row.itemCode === selectedBomItemCode;
                    return (
                    <div
                      key={row.key}
                      ref={(node) => {
                        selectedRoutingRowRefs.current[row.key] = node;
                      }}
                      className={`grid grid-cols-[82px_56px_minmax(150px,1fr)_minmax(130px,1fr)_minmax(190px,280px)_78px] items-center border-b border-border px-3 py-2 text-xs last:border-b-0 ${isSelectedRow ? "bg-primary/10 ring-1 ring-inset ring-primary/40" : ""}`}
                    >
                      <div className={row.orderKind === "ITEM" ? "font-semibold text-sky-600" : "font-semibold text-emerald-600"}>
                        {row.orderKind === "ITEM"
                          ? t("production.order.itemOrder", "품목지시")
                          : t("production.order.operationOrder", "공정지시")}
                      </div>
                      <div>{row.orderKind === "OPERATION" ? row.routingSeq : "-"}</div>
                      <div className="min-w-0" style={{ paddingLeft: row.depth * 14 }}>
                        <div className="truncate font-medium text-text">{row.itemCode}</div>
                        <div className="truncate text-[11px] text-text-muted">{row.itemName || row.routingName || "-"}</div>
                      </div>
                      <div className="min-w-0">
                        {row.orderKind === "OPERATION" ? (
                          <>
                            <div className="truncate font-medium text-text">{row.processName}</div>
                            <div className="truncate text-[11px] text-text-muted">{row.processCode}</div>
                          </>
                        ) : (
                          <div className="truncate text-text-muted">{row.routingCode || "-"}</div>
                        )}
                      </div>
                      {row.orderKind === "OPERATION" && row.processCode ? (
                        <OperationEquipmentSelect
                          process={{
                            seq: row.routingSeq ?? 0,
                            processCode: row.processCode,
                            processName: row.processName ?? row.processCode,
                            equipType: row.equipType,
                          }}
                          value={operationAssignments[row.key] ?? ""}
                          onChange={(value) => setOperationEquip(row.key, value)}
                        />
                      ) : (
                        <div className="text-text-muted">-</div>
                      )}
                      <div className={row.orderKind === "ITEM" || operationAssignments[row.key] ? "text-emerald-600" : "text-amber-500"}>
                        {row.orderKind === "ITEM" ? (
                          <span className="inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {t("production.order.ready", "준비")}
                          </span>
                        ) : operationAssignments[row.key]
                          ? t("production.order.equipAssigned", "지정")
                          : t("production.order.equipUnassigned", "미지정")}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="flex items-center gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              <CalendarDays className="h-4 w-4 flex-shrink-0" />
              {t("production.order.unassignedEquipNotice", "설비 미지정 공정도 저장할 수 있으며, 생성 후 작업지시 수정에서 설비를 배정할 수 있습니다.")}
            </div>
          </section>
        </div>
      </Modal>

      <PartSearchModal
        isOpen={partSearchOpen}
        onClose={() => setPartSearchOpen(false)}
        allowedItemTypes={["FINISHED", "SEMI_PRODUCT"]}
        onSelect={(part) => {
          setForm((prev) => ({ ...prev, itemCode: part.itemCode }));
          setSelectedBomItemCode(part.itemCode);
          setPartSearchOpen(false);
          fetchRouting(part.itemCode);
          fetchBomTree(part.itemCode, form.planDate);
        }}
      />
    </>
  );
}
