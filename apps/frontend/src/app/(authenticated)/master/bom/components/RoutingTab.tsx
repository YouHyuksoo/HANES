"use client";

/**
 * @file src/app/(authenticated)/master/bom/components/RoutingTab.tsx
 * @description 라우팅(공정순서) 탭 - BOM에 연결된 라우팅 그룹의 공정 표시
 *
 * 초보자 가이드:
 * 1. **bomRoutingLinks**: partCode → routingCode 매핑으로 연결된 라우팅 그룹 조회
 * 2. **routingTarget**: BOM에서 특정 아이템 클릭 시 해당 아이템의 라우팅 표시
 * 3. **routingTarget 없으면**: 최상위 부모품목의 라우팅 표시
 */
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, ArrowLeft, AlertCircle } from "lucide-react";
import { Button, Input, Modal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { ParentPart, RoutingItem, RoutingTarget } from "../types";
import { mockRoutingGroups } from "../mockData";

interface RoutingTabProps {
  selectedParent: ParentPart | null;
  routingTarget?: RoutingTarget | null;
  onClearTarget?: () => void;
  bomRoutingLinks?: Map<string, string>;
}

export default function RoutingTab({ selectedParent, routingTarget, onClearTarget, bomRoutingLinks }: RoutingTabProps) {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RoutingItem | null>(null);

  const targetCode = routingTarget?.partCode || selectedParent?.partCode || "";
  const targetName = routingTarget?.partName || selectedParent?.partName || "";

  /** bomRoutingLinks에서 연결된 라우팅 그룹 조회 */
  const linkedRoutingCode = bomRoutingLinks?.get(targetCode);
  const linkedGroup = linkedRoutingCode
    ? mockRoutingGroups.find((g) => g.routingCode === linkedRoutingCode)
    : undefined;
  const data = linkedGroup?.steps || [];

  const columns = useMemo<ColumnDef<RoutingItem>[]>(() => [
    { accessorKey: "seq", header: t("master.routing.seq"), size: 60 },
    { accessorKey: "processCode", header: t("master.routing.processCode"), size: 100 },
    { accessorKey: "processName", header: t("master.routing.processName"), size: 140 },
    {
      accessorKey: "processType", header: t("master.routing.processType"), size: 80,
      cell: ({ getValue }) => {
        const colorMap: Record<string, string> = {
          CUT: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
          CRM: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
          ASM: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
          INS: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
          HSK: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
          STP: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
          PKG: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
        };
        const val = getValue() as string;
        return <span className={`px-2 py-1 text-xs rounded-full ${colorMap[val] || "bg-gray-100 text-gray-700"}`}>{val}</span>;
      },
    },
    { accessorKey: "equipType", header: t("master.routing.equipType"), size: 80 },
    { accessorKey: "stdTime", header: t("master.routing.stdTime"), size: 90, cell: ({ getValue }) => getValue() != null ? `${getValue()}s` : "-" },
    { accessorKey: "setupTime", header: t("master.routing.setupTime"), size: 90, cell: ({ getValue }) => getValue() != null ? `${getValue()}s` : "-" },
    {
      accessorKey: "useYn", header: t("master.routing.use"), size: 60,
      cell: ({ getValue }) => <span className={`w-2 h-2 rounded-full inline-block ${getValue() === "Y" ? "bg-green-500" : "bg-gray-400"}`} />,
    },
    {
      id: "actions", header: t("common.actions"), size: 80,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => { setEditingItem(row.original); setIsModalOpen(true); }} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button className="p-1 hover:bg-surface rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
        </div>
      ),
    },
  ], [t]);

  if (!selectedParent) {
    return <div className="flex items-center justify-center h-64 text-text-muted">{t("master.bom.selectParentPrompt")}</div>;
  }

  return (
    <>
      {/* 라우팅 타겟 표시 (BOM에서 진입한 경우) */}
      {routingTarget && (
        <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-purple-600 dark:text-purple-400 font-medium">BOM 연결:</span>
            <span className="text-text-muted font-mono text-xs">{routingTarget.breadcrumb}</span>
          </div>
          <button
            onClick={onClearTarget}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-purple-100 dark:hover:bg-purple-800/50 text-purple-600 dark:text-purple-400 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            {selectedParent.partCode} 전체 라우팅
          </button>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-text">{targetCode}</p>
          <p className="text-sm text-text-muted">{targetName}</p>
          {linkedGroup ? (
            <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 font-mono">
              {linkedGroup.routingCode} - {linkedGroup.routingName} ({data.length}{t("master.bom.processUnit", "공정")})
            </span>
          ) : (
            <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300">
              {t("master.bom.noRoutingLinked", "라우팅 미연결")}
            </span>
          )}
        </div>
        {linkedGroup && (
          <Button size="sm" onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" />{t("master.routing.addRouting")}
          </Button>
        )}
      </div>

      {!linkedGroup ? (
        <div className="flex flex-col items-center justify-center h-48 text-text-muted border border-dashed border-border rounded-lg">
          <AlertCircle className="w-8 h-8 mb-2 text-orange-400" />
          <p className="text-sm font-medium">{targetCode} {t("master.bom.noRoutingLinkedDesc", "에 연결된 라우팅 그룹이 없습니다")}</p>
          <p className="text-xs mt-1">{t("master.bom.linkFromBomTab", "BOM 탭에서 라우팅 그룹을 연결하세요")}</p>
        </div>
      ) : (
        <DataGrid data={data} columns={columns} pageSize={10} />
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? t("master.routing.editRouting") : t("master.routing.addRouting")} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Input label={t("master.bom.parentPart")} value={targetCode} disabled fullWidth />
          <Input label={t("master.routing.seq")} type="number" placeholder="1" defaultValue={editingItem?.seq?.toString()} fullWidth />
          <Input label={t("master.routing.processCode")} placeholder="CUT-01" defaultValue={editingItem?.processCode} fullWidth />
          <Input label={t("master.routing.processName")} placeholder="전선절단" defaultValue={editingItem?.processName} fullWidth />
          <Input label={t("master.routing.processType")} placeholder="CUT" defaultValue={editingItem?.processType} fullWidth />
          <Input label={t("master.routing.equipType")} placeholder={t("master.routing.equipTypePlaceholder")} defaultValue={editingItem?.equipType} fullWidth />
          <Input label={t("master.routing.stdTimeSec")} type="number" placeholder="5.5" defaultValue={editingItem?.stdTime?.toString()} fullWidth />
          <Input label={t("master.routing.setupTimeSec")} type="number" placeholder="10" defaultValue={editingItem?.setupTime?.toString()} fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
          <Button>{editingItem ? t("common.edit") : t("common.add")}</Button>
        </div>
      </Modal>
    </>
  );
}
