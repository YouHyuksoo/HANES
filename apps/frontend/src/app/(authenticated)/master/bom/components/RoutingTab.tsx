"use client";

/**
 * @file src/app/(authenticated)/master/bom/components/RoutingTab.tsx
 * @description 라우팅(공정순서) 탭 - 읽기 전용. 라우팅관리에서 구성한 라우팅을 보여줌.
 *
 * 초보자 가이드:
 * 1. 품목코드로 라우팅 그룹 조회: GET /master/routing-groups/by-item/:itemCode
 * 2. 등록/수정/삭제 없음 — 라우팅관리 페이지에서 관리
 * 3. routingTarget이 있으면 해당 품목의 라우팅, 없으면 최상위 부모품목의 라우팅
 */
import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Route } from "lucide-react";
import { ComCodeBadge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import { ParentPart, RoutingItem, RoutingTarget } from "../types";

interface RoutingTabProps {
  selectedParent: ParentPart | null;
  routingTarget?: RoutingTarget | null;
  onClearTarget?: () => void;
}

export default function RoutingTab({ selectedParent, routingTarget, onClearTarget }: RoutingTabProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<RoutingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [routingGroupInfo, setRoutingGroupInfo] = useState<{ routingCode: string; routingName: string } | null>(null);

  const itemCode = routingTarget?.itemCode || selectedParent?.itemCode || "";
  const targetName = routingTarget?.itemName || selectedParent?.itemName || "";

  /** 라우팅 그룹 API로 조회 (읽기 전용) */
  const fetchRoutings = useCallback(async () => {
    if (!itemCode) { setData([]); setRoutingGroupInfo(null); return; }
    setLoading(true);
    try {
      const res = await api.get(`/master/routing-groups/by-item/${itemCode}`);
      const groupData = res.data?.data;
      if (groupData) {
        setRoutingGroupInfo({ routingCode: groupData.routingCode, routingName: groupData.routingName });
        setData(groupData.processes || []);
      } else {
        setRoutingGroupInfo(null);
        setData([]);
      }
    } catch { setData([]); setRoutingGroupInfo(null); }
    finally { setLoading(false); }
  }, [itemCode]);

  useEffect(() => { fetchRoutings(); }, [fetchRoutings]);

  const columns = useMemo<ColumnDef<RoutingItem>[]>(() => [
    { accessorKey: "seq", header: t("master.routing.seq"), size: 60, meta: { filterType: "number" as const } },
    { accessorKey: "processCode", header: t("master.routing.processCode"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "processName", header: t("master.routing.processName"), size: 140, meta: { filterType: "text" as const } },
    {
      accessorKey: "processType", header: t("master.routing.processType"), size: 90,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const val = getValue() as string;
        return val ? <ComCodeBadge groupCode="PROCESS_TYPE" code={val} /> : "-";
      },
    },
    { accessorKey: "equipType", header: t("master.routing.equipType"), size: 80, meta: { filterType: "text" as const } },
    { accessorKey: "stdTime", header: t("master.routing.stdTime"), size: 90, meta: { filterType: "number" as const }, cell: ({ getValue }) => getValue() != null ? `${getValue()}s` : "-" },
    { accessorKey: "setupTime", header: t("master.routing.setupTime"), size: 90, meta: { filterType: "number" as const }, cell: ({ getValue }) => getValue() != null ? `${getValue()}s` : "-" },
    {
      accessorKey: "useYn", header: t("master.routing.use"), size: 60,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <span className={`w-2 h-2 rounded-full inline-block ${getValue() === "Y" ? "bg-green-500" : "bg-gray-400"}`} />,
    },
  ], [t]);

  if (!selectedParent) {
    return <div className="flex items-center justify-center h-64 text-text-muted dark:text-gray-400">{t("master.bom.selectParentPrompt")}</div>;
  }

  return (
    <>
      {routingTarget && (
        <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-purple-600 dark:text-purple-400 font-medium">{t("master.bom.routingViewTarget")}:</span>
            <span className="text-text-muted dark:text-gray-400 font-mono text-xs">{routingTarget.breadcrumb}</span>
          </div>
          <button onClick={onClearTarget}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-purple-100 dark:hover:bg-purple-800/50 text-purple-600 dark:text-purple-400 transition-colors">
            <ArrowLeft className="w-3 h-3" />
            {t("master.bom.viewAllRouting")}
          </button>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-text dark:text-gray-200">{itemCode}</p>
          <p className="text-sm text-text-muted dark:text-gray-400">{targetName}</p>
          {routingGroupInfo && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
              <Route className="w-3 h-3" />
              {routingGroupInfo.routingCode}
            </span>
          )}
          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
            {data.length}{t("master.routing.processCount")}
          </span>
        </div>
        {/* 등록 버튼 제거 — 라우팅관리에서 관리 */}
      </div>

      <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport exportFileName={`${itemCode}_routing`}
        emptyMessage={t("master.bom.noRoutingData")} />
    </>
  );
}
