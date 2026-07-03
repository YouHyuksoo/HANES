"use client";

/**
 * @file src/app/(authenticated)/master/bom/components/BomTab.tsx
 * @description BOM 레벨 트리뷰 탭 - DB API 연동 + CRUD
 *
 * 초보자 가이드:
 * 1. **API 호출**: GET /master/boms/hierarchy/:parentPartId 로 트리 데이터 조회
 * 2. **추가/수정**: BomFormModal 컴포넌트로 분리
 * 3. **삭제**: ConfirmModal로 확인 후 DELETE /master/boms/:id
 * 4. **라우팅관리 이동**: onViewRouting 콜백으로 품목 전달 → /master/routing 이동
 */
import { useState, useCallback, useEffect, Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Plus, ChevronRight, ChevronDown, Package, Boxes, CircleDot, Edit2, Trash2, GitBranch, Download, Upload } from "lucide-react";
import { Button, ConfirmModal } from "@/components/ui";
import api from "@/services/api";
import BomFormModal from "./BomFormModal";
import BomUploadModal from "./BomUploadModal";
import { ParentPart, BomTreeItem, RoutingTarget, getBomKey } from "../types";
import { formatDateOnly, getTodayLocal } from "@/utils/date";

const partTypeConfig: Record<string, { icon: typeof Package; color: string; bg: string }> = {
  FINISHED: { icon: Package, color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-900/50" },
  SEMI_PRODUCT: { icon: Boxes, color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-100 dark:bg-amber-900/50" },
  RAW_MATERIAL: { icon: CircleDot, color: "text-blue-700 dark:text-blue-300", bg: "bg-blue-100 dark:bg-blue-900/50" },
  CONSUMABLE: { icon: CircleDot, color: "text-violet-700 dark:text-violet-300", bg: "bg-violet-100 dark:bg-violet-900/50" },
};

const levelColors = ["bg-emerald-500", "bg-blue-500", "bg-amber-500", "bg-purple-500", "bg-pink-500"];

type RawBomTreeItem = Omit<BomTreeItem, "bomKey" | "children"> & {
  id?: string;
  bomKey?: string;
  children?: RawBomTreeItem[];
};

const normalizeBomTree = (items: RawBomTreeItem[]): BomTreeItem[] =>
  items.map((item) => {
    const { id, bomKey, children, ...rest } = item;
    return {
      ...rest,
      bomKey: bomKey || id || `${item.itemCode}::${item.childItemCode || item.itemCode}::${formatDateOnly(item.validFrom)}`,
      children: children ? normalizeBomTree(children) : undefined,
    };
  });

interface BomTabProps {
  selectedParent: ParentPart | null;
  onViewRouting?: (target: RoutingTarget) => void;
  onSelectItem?: (target: RoutingTarget) => void;
  selectedItemCode?: string | null;
  effectiveDate?: string;
  compact?: boolean;
}

export default function BomTab({ selectedParent, onViewRouting, onSelectItem, selectedItemCode, effectiveDate, compact = false }: BomTabProps) {
  const { t } = useTranslation();
  const [bomTree, setBomTree] = useState<BomTreeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBom, setEditingBom] = useState<BomTreeItem | null>(null);
  const [deletingBom, setDeletingBom] = useState<BomTreeItem | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<BomTreeItem | null>(null);

  const fetchBomTree = useCallback(async () => {
    if (!selectedParent) { setBomTree([]); return; }
    setLoading(true);
    try {
      const params: Record<string, string | number> = { depth: 10 };
      if (effectiveDate) params.effectiveDate = effectiveDate;
      const res = await api.get(`/master/boms/hierarchy/${selectedParent.itemCode}`, { params });
      if (res.data.success) setBomTree(normalizeBomTree(res.data.data || []));
    } catch { setBomTree([]); }
    finally { setLoading(false); }
  }, [selectedParent, effectiveDate]);

  useEffect(() => { fetchBomTree(); }, [fetchBomTree]);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }, []);

  const rootId = selectedParent ? `ROOT::${selectedParent.itemCode}` : "";

  const treeWithRoot: BomTreeItem[] = selectedParent ? [{
    bomKey: rootId,
    level: 0,
    itemCode: selectedParent.itemCode,
    itemNo: selectedParent.itemNo || null,
    itemName: selectedParent.itemName,
    itemType: selectedParent.itemType,
    qtyPer: 1,
    unit: selectedParent.unit || "EA",
    revision: selectedParent.revisions?.[0] || "-",
    seq: 0,
    validFrom: selectedParent.validFrom ?? undefined,
    validTo: selectedParent.validTo ?? undefined,
    useYn: "Y",
    children: bomTree,
    isRoot: true,
  }] : [];

  useEffect(() => {
    if (!rootId) return;
    setExpanded((prev) => new Set(prev).add(rootId));
  }, [rootId]);

  useEffect(() => { setSelectedNode(null); }, [selectedParent]);

  const expandAll = useCallback(() => {
    const allIds = new Set<string>();
    const collect = (items: BomTreeItem[]) => { items.forEach((item) => { if (item.children?.length) { allIds.add(getBomKey(item)); collect(item.children); } }); };
    collect(treeWithRoot);
    setExpanded(allIds);
  }, [treeWithRoot]);

  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  const countItems = (items: BomTreeItem[]): number =>
    items.reduce((sum, item) => sum + 1 + (item.children ? countItems(item.children) : 0), 0);

  const handleEdit = useCallback((item: BomTreeItem) => { setEditingBom(item); setIsModalOpen(true); }, []);

  const handleDelete = useCallback(async () => {
    if (!deletingBom) return;
    try {
      await api.delete(`/master/boms/${getBomKey(deletingBom)}`);
      setDeletingBom(null);
      fetchBomTree();
    } catch { /* API 에러는 인터셉터에서 처리 */ }
  }, [deletingBom, fetchBomTree]);

  const handleViewRouting = useCallback((item: BomTreeItem, breadcrumb: string) => {
    onViewRouting?.({ itemCode: item.childItemCode || item.itemCode, itemName: item.itemName, itemType: item.itemType, breadcrumb });
  }, [onViewRouting]);

  const handleExport = useCallback(async () => {
    const params = new URLSearchParams();
    if (selectedParent) params.set("parentItemCode", selectedParent.itemCode);
    const res = await api.get(`/master/boms/export?${params}`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BOM_${selectedParent?.itemCode || "ALL"}_${getTodayLocal()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedParent]);

  if (!selectedParent) {
    return <div className="flex items-center justify-center h-64 text-text-muted">{t("master.bom.selectParentPrompt")}</div>;
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className={`flex justify-between items-center flex-shrink-0 ${compact ? "mb-2" : "mb-4"}`}>
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm text-text-muted">{selectedParent.itemName} ({countItems(treeWithRoot)}{t("master.bom.materialsCount")})</p>
          <div className="flex gap-1 shrink-0">
            <button onClick={expandAll} className="px-2 py-1 text-xs rounded bg-surface hover:bg-border text-text-muted transition-colors">
              {t("master.bom.expandAll", "전체 펼치기")}
            </button>
            <button onClick={collapseAll} className="px-2 py-1 text-xs rounded bg-surface hover:bg-border text-text-muted transition-colors">
              {t("master.bom.collapseAll", "전체 접기")}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="ghost" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" />{t("common.export")}
          </Button>
          {!compact && <Button size="sm" variant="ghost" onClick={() => setUploadModalOpen(true)}>
            <Upload className="w-4 h-4 mr-1" />{t("master.bom.excelUpload")}
          </Button>}
          <Button size="sm" onClick={() => { setEditingBom(null); setIsModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" />{t("master.bom.addBom")}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto min-h-0 rounded-[var(--radius)] border border-border">
        <table className="font-data text-xs min-w-[1160px] table-fixed">
          <thead className="bg-background">
            <tr>
              <th className="px-2 py-2 text-left font-semibold text-text border-b border-r border-border w-10 whitespace-nowrap">Lv</th>
              <th className="px-2 py-2 text-left font-semibold text-text border-b border-r border-border w-[190px] whitespace-nowrap">{t("master.bom.childPartCode")}</th>
              <th className="px-2 py-2 text-left font-semibold text-text border-b border-r border-border w-[220px] whitespace-nowrap">{t("master.bom.childPartName")}</th>
              <th className="px-2 py-2 text-center font-semibold text-text border-b border-r border-border w-24 whitespace-nowrap">{t("master.bom.type")}</th>
              <th className="px-2 py-2 text-center font-semibold text-text border-b border-r border-border w-36 whitespace-nowrap">{t("master.bom.oper", "공정")}</th>
              <th className="px-2 py-2 text-right font-semibold text-text border-b border-r border-border w-24 whitespace-nowrap">{t("master.bom.qtyPer")}</th>
              <th className="px-2 py-2 text-center font-semibold text-text border-b border-r border-border w-16 whitespace-nowrap">{t("master.bom.revision")}</th>
              <th className="px-2 py-2 text-center font-semibold text-text border-b border-r border-border w-14 whitespace-nowrap">{t("master.bom.side", "사이드")}</th>
              <th className="px-2 py-2 text-center font-semibold text-text border-b border-r border-border w-24 whitespace-nowrap">{t("master.bom.validFrom")}</th>
              <th className="px-2 py-2 text-center font-semibold text-text border-b border-r border-border w-24 whitespace-nowrap">{t("master.bom.validTo")}</th>
              <th className="px-2 py-2 text-center font-semibold text-text border-b border-border w-20 whitespace-nowrap">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="px-4 py-12 text-center text-text-muted">{t("common.loading")}</td></tr>
            ) : treeWithRoot.length === 0 ? (
              <tr><td colSpan={11} className="px-4 py-12 text-center text-text-muted">{t("master.bom.noBomData", "BOM 데이터가 없습니다.")}</td></tr>
            ) : (
              <BomTreeRows items={treeWithRoot} expanded={expanded} onToggle={toggleExpand}
                onEdit={handleEdit} onDelete={setDeletingBom} onViewRouting={handleViewRouting}
                onSelectItem={onSelectItem} onSelectNode={setSelectedNode} selectedItemCode={selectedItemCode}
                parentCode={selectedParent.itemCode} t={t} />
            )}
          </tbody>
        </table>
      </div>

      {!compact && <div className="flex gap-4 mt-3 text-xs text-text-muted flex-shrink-0">
        {Object.entries(partTypeConfig).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color} text-[10px] font-medium`}>
              {t(`comCode.ITEM_TYPE.${key}`, { defaultValue: key })}
            </span>
          </div>
        ))}
      </div>}

      <BomFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={fetchBomTree}
        editingItem={editingBom}
        parentItemCode={editingBom ? selectedParent.itemCode : (selectedNode && !selectedNode.isRoot ? (selectedNode.childItemCode || selectedNode.itemCode) : selectedParent.itemCode)}
        parentItemCodeDisplay={editingBom ? selectedParent.itemCode : (selectedNode && !selectedNode.isRoot ? (selectedNode.itemNo || selectedNode.childItemCode || selectedNode.itemCode) : selectedParent.itemCode)} />

      <ConfirmModal isOpen={!!deletingBom} onClose={() => setDeletingBom(null)} onConfirm={handleDelete}
        title={t("common.delete")} message={t("master.bom.deleteConfirm")} variant="danger" />

      <BomUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onComplete={() => fetchBomTree()}
      />
    </div>
  );
}

function BomTreeRows({
  items, expanded, onToggle, onEdit, onDelete, onViewRouting, onSelectItem, onSelectNode, selectedItemCode, parentCode, t, depth = 0, breadcrumb = "",
}: {
  items: BomTreeItem[]; expanded: Set<string>; onToggle: (id: string) => void;
  onEdit: (item: BomTreeItem) => void; onDelete: (item: BomTreeItem) => void;
  onViewRouting: (item: BomTreeItem, breadcrumb: string) => void;
  onSelectItem?: (target: RoutingTarget) => void;
  onSelectNode?: (item: BomTreeItem) => void;
  selectedItemCode?: string | null;
  parentCode: string; t: any; depth?: number; breadcrumb?: string;
}) {
  return (
    <>
      {items.map((item, idx) => {
        const hasChildren = item.children && item.children.length > 0;
        const itemKey = getBomKey(item);
        const isExpanded = expanded.has(itemKey);
        const cfg = partTypeConfig[item.itemType] || partTypeConfig.RAW_MATERIAL;
        const Icon = cfg.icon;
        const levelColor = levelColors[item.level % levelColors.length];
        const itemCode = item.childItemCode || item.itemCode;
        const itemBreadcrumb = item.isRoot ? itemCode : breadcrumb ? `${breadcrumb} > ${itemCode}` : `${parentCode} > ${itemCode}`;
        const validFrom = formatDateOnly(item.validFrom, "-");
        const validTo = formatDateOnly(item.validTo, "-");
        const isSelected = selectedItemCode === itemCode;

        return (
          <Fragment key={itemKey}>
            <tr
              onClick={() => { onSelectItem?.({ itemCode, itemName: item.itemName, itemType: item.itemType, breadcrumb: itemBreadcrumb }); onSelectNode?.(item); }}
              className={`border-b border-border last:border-b-0 transition-colors cursor-pointer ${
                isSelected ? "bg-primary text-white" : idx % 2 === 0 ? "bg-surface hover:bg-primary/5" : "bg-background/50 hover:bg-primary/5"
              }`}
            >
              <td className="px-2 py-1.5 border-r border-border whitespace-nowrap">
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-bold ${levelColor}`}>{item.level}</span>
              </td>
              <td className="px-2 py-1.5 border-r border-border whitespace-nowrap">
                <div className="flex items-center" style={{ paddingLeft: `${depth * 24}px` }}>
                  {hasChildren ? (
                    <button onClick={(event) => { event.stopPropagation(); onToggle(itemKey); }} className="mr-2 p-0.5 rounded hover:bg-surface transition-colors">
                      {isExpanded ? <ChevronDown className={`w-4 h-4 ${isSelected ? "text-white/80" : "text-text-muted"}`} /> : <ChevronRight className={`w-4 h-4 ${isSelected ? "text-white/80" : "text-text-muted"}`} />}
                    </button>
                  ) : (
                    <span className="w-5 mr-2 flex justify-center"><span className="w-1.5 h-1.5 rounded-full bg-border" /></span>
                  )}
                  <Icon className={`w-4 h-4 mr-1.5 flex-shrink-0 ${cfg.color}`} />
                  <span className="font-mono text-text font-medium">{item.itemNo || item.itemCode}</span>
                </div>
              </td>
              <td className="px-2 py-1.5 border-r border-border whitespace-nowrap truncate" title={item.itemName}>
                <span className="truncate">{item.itemName}</span>
                {hasChildren && <span className={`ml-1 text-[10px] ${isSelected ? "text-white/70" : "text-text-muted"}`}>({item.children!.length})</span>}
              </td>
              <td className="px-2 py-1.5 border-r border-border text-center whitespace-nowrap">
                <span className={`inline-flex px-1.5 py-0.5 text-[10px] rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
                  {t(`comCode.ITEM_TYPE.${item.itemType}`, { defaultValue: item.itemType })}
                </span>
              </td>
              <td className={`px-2 py-1.5 border-r border-border text-center font-mono ${isSelected ? "text-white/80" : "text-text-muted"}`}>
                {item.processCode ? (
                  <div>
                    <div className="text-[11px] whitespace-nowrap">{item.processCode}</div>
                    {item.processName && <div className={`text-[10px] whitespace-nowrap ${isSelected ? "text-white/60" : "text-text-muted/70"}`}>{item.processName}</div>}
                  </div>
                ) : "-"}
              </td>
              <td className="px-2 py-1.5 border-r border-border text-right font-mono whitespace-nowrap">{(item.qtyPer ?? 0).toLocaleString()} {item.unit}</td>
              <td className="px-2 py-1.5 border-r border-border text-center whitespace-nowrap">{item.revision}</td>
              <td className={`px-2 py-1.5 border-r border-border text-center whitespace-nowrap ${isSelected ? "text-white/80" : "text-text-muted"}`}>{item.side || "-"}</td>
              <td className="px-2 py-1.5 border-r border-border text-center font-mono whitespace-nowrap">{validFrom}</td>
              <td className="px-2 py-1.5 border-r border-border text-center font-mono whitespace-nowrap">{validTo}</td>
              <td className="px-2 py-1.5 text-center whitespace-nowrap">
                <div className="flex justify-center gap-1">
                  <button onClick={(event) => { event.stopPropagation(); onViewRouting(item, itemBreadcrumb); }} className="p-1 hover:bg-surface rounded" title={t("master.bom.goRoutingManagement")}>
                    <GitBranch className="w-3.5 h-3.5 text-purple-500" />
                  </button>
                  {!item.isRoot && <button onClick={(event) => { event.stopPropagation(); onEdit(item); }} className="p-1 hover:bg-surface rounded">
                    <Edit2 className="w-3.5 h-3.5 text-primary" />
                  </button>}
                  {!item.isRoot && <button onClick={(event) => { event.stopPropagation(); onDelete(item); }} className="p-1 hover:bg-surface rounded">
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>}
                </div>
              </td>
            </tr>
            {hasChildren && isExpanded && (
              <BomTreeRows key={`${itemKey}-children`} items={item.children!} expanded={expanded} onToggle={onToggle}
                onEdit={onEdit} onDelete={onDelete} onViewRouting={onViewRouting}
                onSelectItem={onSelectItem} onSelectNode={onSelectNode} selectedItemCode={selectedItemCode}
                parentCode={parentCode} t={t} depth={depth + 1} breadcrumb={itemBreadcrumb} />
            )}
          </Fragment>
        );
      })}
    </>
  );
}
