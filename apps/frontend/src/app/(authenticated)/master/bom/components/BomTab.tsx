"use client";

/**
 * @file src/app/(authenticated)/master/bom/components/BomTab.tsx
 * @description BOM 레벨 트리뷰 탭 - DB API 연동 + 유효일자 필터
 *
 * 초보자 가이드:
 * 1. **API 호출**: GET /master/boms/hierarchy/:parentPartId 로 트리 데이터 조회
 * 2. **effectiveDate**: 적용일/완료일 기준 필터링 (validFrom <= date AND validTo >= date)
 * 3. **접기/펼치기**: 하위 자재가 있는 항목은 클릭으로 전개/접기 가능
 */
import { useState, useCallback, useEffect, Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Plus, ChevronRight, ChevronDown, Package, Boxes, CircleDot } from "lucide-react";
import { Button, Modal, Input } from "@/components/ui";
import api from "@/services/api";
import RoutingLinkModal from "./RoutingLinkModal";
import { ParentPart, BomTreeItem, RoutingTarget } from "../types";

const partTypeConfig: Record<string, { icon: typeof Package; color: string; bg: string }> = {
  FG: { icon: Package, color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-900/50" },
  WIP: { icon: Boxes, color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-100 dark:bg-amber-900/50" },
  RAW: { icon: CircleDot, color: "text-blue-700 dark:text-blue-300", bg: "bg-blue-100 dark:bg-blue-900/50" },
};

const levelColors = ["bg-emerald-500", "bg-blue-500", "bg-amber-500", "bg-purple-500", "bg-pink-500"];

interface BomTabProps {
  selectedParent: ParentPart | null;
  onViewRouting?: (target: RoutingTarget) => void;
  bomRoutingLinks?: Map<string, string>;
  onLinkRouting?: (partCode: string, routingCode: string) => void;
  onUnlinkRouting?: (partCode: string) => void;
  effectiveDate?: string;
}

export default function BomTab({ selectedParent, onViewRouting, bomRoutingLinks, onLinkRouting, onUnlinkRouting, effectiveDate }: BomTabProps) {
  const { t } = useTranslation();
  const [bomTree, setBomTree] = useState<BomTreeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBom, setEditingBom] = useState<BomTreeItem | null>(null);
  const [linkingItem, setLinkingItem] = useState<{ item: BomTreeItem; breadcrumb: string } | null>(null);

  /** API에서 BOM 트리 조회 (유효일자 필터 포함) */
  const fetchBomTree = useCallback(async () => {
    if (!selectedParent) { setBomTree([]); return; }
    setLoading(true);
    try {
      const params: Record<string, string | number> = { depth: 5 };
      if (effectiveDate) params.effectiveDate = effectiveDate;
      const res = await api.get(`/master/boms/hierarchy/${selectedParent.id}`, { params });
      if (res.data.success) setBomTree(res.data.data || []);
    } catch { setBomTree([]); }
    finally { setLoading(false); }
  }, [selectedParent, effectiveDate]);

  useEffect(() => { fetchBomTree(); }, [fetchBomTree]);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allIds = new Set<string>();
    const collect = (items: BomTreeItem[]) => {
      items.forEach((item) => { if (item.children?.length) { allIds.add(item.id); collect(item.children); } });
    };
    collect(bomTree);
    setExpanded(allIds);
  }, [bomTree]);

  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  const countItems = (items: BomTreeItem[]): number =>
    items.reduce((sum, item) => sum + 1 + (item.children ? countItems(item.children) : 0), 0);

  if (!selectedParent) {
    return <div className="flex items-center justify-center h-64 text-text-muted">{t("master.bom.selectParentPrompt")}</div>;
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <p className="text-sm text-text-muted">
            {selectedParent.partName} ({countItems(bomTree)}{t("master.bom.materialsCount")})
          </p>
          <div className="flex gap-1">
            <button onClick={expandAll} className="px-2 py-1 text-xs rounded bg-surface hover:bg-border text-text-muted transition-colors">
              {t("master.bom.expandAll", "전체 펼치기")}
            </button>
            <button onClick={collapseAll} className="px-2 py-1 text-xs rounded bg-surface hover:bg-border text-text-muted transition-colors">
              {t("master.bom.collapseAll", "전체 접기")}
            </button>
          </div>
        </div>
        <Button size="sm" onClick={() => { setEditingBom(null); setIsModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" />{t("master.bom.addBom")}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-border">
        <table className="font-data text-sm min-w-[1060px]">
          <thead className="bg-background">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-text border-b border-r border-border w-10">Lv</th>
              <th className="px-4 py-3 text-left font-semibold text-text border-b border-r border-border min-w-[180px]">{t("master.bom.childPartCode")}</th>
              <th className="px-4 py-3 text-left font-semibold text-text border-b border-r border-border min-w-[140px]">{t("master.bom.childPartName")}</th>
              <th className="px-4 py-3 text-center font-semibold text-text border-b border-r border-border w-24">{t("master.bom.type")}</th>
              <th className="px-4 py-3 text-center font-semibold text-text border-b border-r border-border w-20">{t("master.bom.oper", "공정")}</th>
              <th className="px-4 py-3 text-right font-semibold text-text border-b border-r border-border w-28">{t("master.bom.qtyPer")}</th>
              <th className="px-4 py-3 text-center font-semibold text-text border-b border-r border-border w-20">{t("master.bom.revision")}</th>
              <th className="px-4 py-3 text-center font-semibold text-text border-b border-r border-border w-16">{t("master.bom.side", "사이드")}</th>
              <th className="px-4 py-3 text-center font-semibold text-text border-b border-r border-border w-28">{t("master.bom.validFrom")}</th>
              <th className="px-4 py-3 text-center font-semibold text-text border-b border-border w-28">{t("master.bom.validTo")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-text-muted">{t("common.loading")}</td></tr>
            ) : bomTree.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-text-muted">BOM 데이터가 없습니다.</td></tr>
            ) : (
              <BomTreeRows items={bomTree} expanded={expanded} onToggle={toggleExpand}
                bomRoutingLinks={bomRoutingLinks} onUnlinkRouting={onUnlinkRouting}
                onOpenLinkModal={(item, breadcrumb) => setLinkingItem({ item, breadcrumb })}
                parentCode={selectedParent.partCode} t={t} />
            )}
          </tbody>
        </table>
      </div>

      <div className="flex gap-4 mt-3 text-xs text-text-muted">
        {Object.entries(partTypeConfig).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color} text-[10px] font-medium`}>{key}</span>
            <span>{t(`comCode.PART_TYPE.${key}`, { defaultValue: key })}</span>
          </div>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        title={editingBom ? t("master.bom.editBom") : t("master.bom.addBom")} size="md">
        <div className="space-y-4">
          <Input label={t("master.bom.parentPart")} value={selectedParent.partCode} disabled fullWidth />
          <Input label={t("master.bom.childPartCode")} placeholder={t("master.bom.searchChildPlaceholder")} defaultValue={editingBom?.partCode} fullWidth />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("master.bom.qtyPer")} type="number" step="0.01" placeholder="1.0" defaultValue={editingBom?.qtyPer?.toString()} fullWidth />
            <Input label={t("master.bom.unitLabel")} placeholder="EA, M, KG" defaultValue={editingBom?.unit || "EA"} fullWidth />
          </div>
          <Input label={t("master.bom.revision")} placeholder="A" defaultValue={editingBom?.revision || "A"} fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
          <Button>{editingBom ? t("common.edit") : t("common.add")}</Button>
        </div>
      </Modal>

      <RoutingLinkModal isOpen={!!linkingItem} onClose={() => setLinkingItem(null)}
        item={linkingItem?.item || null}
        onLink={(partCode, routingCode) => { onLinkRouting?.(partCode, routingCode); setLinkingItem(null); }} />
    </>
  );
}

function BomTreeRows({
  items, expanded, onToggle, bomRoutingLinks, onUnlinkRouting, onOpenLinkModal, parentCode, t, depth = 0, breadcrumb = "",
}: {
  items: BomTreeItem[]; expanded: Set<string>; onToggle: (id: string) => void;
  bomRoutingLinks?: Map<string, string>; onUnlinkRouting?: (partCode: string) => void;
  onOpenLinkModal?: (item: BomTreeItem, breadcrumb: string) => void;
  parentCode: string; t: any; depth?: number; breadcrumb?: string;
}) {
  return (
    <>
      {items.map((item, idx) => {
        const hasChildren = item.children && item.children.length > 0;
        const isExpanded = expanded.has(item.id);
        const cfg = partTypeConfig[item.partType] || partTypeConfig.RAW;
        const Icon = cfg.icon;
        const levelColor = levelColors[item.level % levelColors.length];
        const itemBreadcrumb = breadcrumb ? `${breadcrumb} > ${item.partCode}` : `${parentCode} > ${item.partCode}`;
        const validFrom = item.validFrom ? new Date(item.validFrom).toISOString().split("T")[0] : "-";
        const validTo = item.validTo ? new Date(item.validTo).toISOString().split("T")[0] : "-";

        return (
          <Fragment key={item.id}>
            <tr className={`border-b border-border last:border-b-0 transition-colors hover:bg-primary/5 ${idx % 2 === 0 ? "bg-surface" : "bg-background/50"}`}>
              <td className="px-4 py-2.5 border-r border-border">
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-[11px] font-bold ${levelColor}`}>{item.level}</span>
              </td>
              <td className="px-4 py-2.5 border-r border-border whitespace-nowrap">
                <div className="flex items-center" style={{ paddingLeft: `${depth * 24}px` }}>
                  {hasChildren ? (
                    <button onClick={() => onToggle(item.id)} className="mr-2 p-0.5 rounded hover:bg-surface transition-colors">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
                    </button>
                  ) : (
                    <span className="w-5 mr-2 flex justify-center"><span className="w-1.5 h-1.5 rounded-full bg-border" /></span>
                  )}
                  <Icon className={`w-4 h-4 mr-1.5 flex-shrink-0 ${cfg.color}`} />
                  <span className="font-mono text-text font-medium">{item.partNo || item.partCode}</span>
                </div>
              </td>
              <td className="px-4 py-2.5 border-r border-border text-text">
                {item.partName}
                {hasChildren && <span className="ml-1 text-[10px] text-text-muted">({item.children!.length})</span>}
              </td>
              <td className="px-4 py-2.5 border-r border-border text-center">
                <span className={`inline-flex px-2 py-0.5 text-xs rounded-full font-medium ${cfg.bg} ${cfg.color}`}>{item.partType}</span>
              </td>
              <td className="px-4 py-2.5 border-r border-border text-center text-xs text-text-muted font-mono">{item.processCode || "-"}</td>
              <td className="px-4 py-2.5 border-r border-border text-right font-mono text-text">{item.qtyPer} {item.unit}</td>
              <td className="px-4 py-2.5 border-r border-border text-center text-text">{item.revision}</td>
              <td className="px-4 py-2.5 border-r border-border text-center text-xs text-text-muted">{item.side || "-"}</td>
              <td className="px-4 py-2.5 border-r border-border text-center text-xs text-text font-mono whitespace-nowrap">{validFrom}</td>
              <td className="px-4 py-2.5 text-center text-xs text-text font-mono whitespace-nowrap">{validTo}</td>
            </tr>
            {hasChildren && isExpanded && (
              <BomTreeRows key={`${item.id}-children`} items={item.children!} expanded={expanded} onToggle={onToggle}
                bomRoutingLinks={bomRoutingLinks} onUnlinkRouting={onUnlinkRouting}
                onOpenLinkModal={onOpenLinkModal} parentCode={parentCode}
                t={t} depth={depth + 1} breadcrumb={itemBreadcrumb} />
            )}
          </Fragment>
        );
      })}
    </>
  );
}


