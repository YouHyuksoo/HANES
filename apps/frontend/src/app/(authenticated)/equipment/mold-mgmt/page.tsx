"use client";

/**
 * @file src/app/(authenticated)/equipment/mold-mgmt/page.tsx
 * @description 금형관리 페이지 - 금형 마스터 목록 + 우측 슬라이드 패널(등록/수정)
 *
 * 초보자 가이드:
 * 1. **DataGrid**: 금형 마스터 목록 (타수율 경고 하이라이트 포함)
 * 2. **우측 패널**: MoldFormPanel 슬라이드 패널로 등록/수정
 * 3. **하단 패널**: MoldUsageList로 선택 금형의 사용이력 표시
 * 4. **필터**: 검색어, 금형유형, 상태 필터링
 * 5. API: GET /equipment/molds, GET /equipment/molds/maintenance-due
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus, RefreshCw, Search, Wrench, AlertTriangle,
  CheckCircle, XCircle, Calendar,
} from "lucide-react";
import { Card, CardContent, Button, Input, StatCard, ComCodeBadge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";
import MoldFormPanel from "./components/MoldFormPanel";
import MoldUsageList from "./components/MoldUsageList";

/** 금형 마스터 데이터 타입 */
interface MoldMaster {
  moldCode: string;
  moldName: string;
  moldType: string;
  itemCode: string;
  cavity: number;
  currentShots: number;
  guaranteedShots: number;
  status: string;
  maintenanceCycle: number;
  lastMaintenanceDate: string | null;
  nextMaintenanceDate: string | null;
  location: string;
  maker: string;
  purchaseDate: string | null;
  remarks: string;
}

export default function MoldMgmtPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<MoldMaster[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<MoldMaster | null>(null);

  /* -- 필터 -- */
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  /* -- 패널 -- */
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MoldMaster | null>(null);

  /* -- 데이터 조회 -- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (typeFilter) params.moldType = typeFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/equipment/molds", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, typeFilter, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* -- 통계 -- */
  const stats = useMemo(() => {
    const total = data.length;
    const normal = data.filter(d => d.status === "NORMAL").length;
    const warning = data.filter(d =>
      d.currentShots > d.guaranteedShots * 0.9 && d.currentShots <= d.guaranteedShots,
    ).length;
    const overdue = data.filter(d => d.currentShots > d.guaranteedShots).length;
    const retired = data.filter(d => d.status === "RETIRED").length;
    return { total, normal, warning, overdue, retired };
  }, [data]);

  /* -- 보전대상 조회 -- */
  const [showMaintenanceDue, setShowMaintenanceDue] = useState(false);
  const handleMaintenanceDue = useCallback(async () => {
    if (showMaintenanceDue) {
      fetchData();
      setShowMaintenanceDue(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get("/equipment/molds/maintenance-due");
      setData(res.data?.data ?? []);
      setShowMaintenanceDue(true);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [showMaintenanceDue, fetchData]);

  /* -- 행 하이라이트 -- */
  const getRowClassName = useCallback((row: MoldMaster) => {
    if (row.currentShots > row.guaranteedShots) {
      return "bg-red-50 dark:bg-red-950/30";
    }
    if (row.currentShots > row.guaranteedShots * 0.9) {
      return "bg-yellow-50 dark:bg-yellow-950/30";
    }
    return "";
  }, []);

  /* -- 컬럼 정의 -- */
  const columns = useMemo<ColumnDef<MoldMaster>[]>(() => [
    { accessorKey: "moldCode", header: t("equipment.mold.moldCode"), size: 130,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span> },
    { accessorKey: "moldName", header: t("equipment.mold.moldName"), size: 160,
      meta: { filterType: "text" as const } },
    { accessorKey: "moldType", header: t("equipment.mold.moldType"), size: 110,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="MOLD_TYPE" code={getValue() as string} /> },
    { accessorKey: "itemCode", header: t("equipment.mold.itemCode"), size: 130,
      meta: { filterType: "text" as const } },
    { accessorKey: "cavity", header: t("equipment.mold.cavity"), size: 80,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => <span className="font-mono text-right block">{getValue() as number}</span> },
    { accessorKey: "currentShots", header: t("equipment.mold.currentShots"), size: 100,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => <span className="font-mono text-right block">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: "guaranteedShots", header: t("equipment.mold.guaranteedShots"), size: 100,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => <span className="font-mono text-right block">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: "shotRate", header: t("equipment.mold.shotRate"), size: 90,
      accessorFn: (row) => row.guaranteedShots > 0
        ? Math.round((row.currentShots / row.guaranteedShots) * 100) : 0,
      cell: ({ getValue }) => {
        const rate = getValue() as number;
        const color = rate > 100 ? "text-red-600 dark:text-red-400"
          : rate > 90 ? "text-yellow-600 dark:text-yellow-400"
          : "text-green-600 dark:text-green-400";
        return <span className={`font-mono text-right block font-semibold ${color}`}>{rate}%</span>;
      } },
    { accessorKey: "status", header: t("equipment.mold.status"), size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="MOLD_STATUS" code={getValue() as string} /> },
    { accessorKey: "nextMaintenanceDate", header: t("equipment.mold.nextMaint"), size: 110,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) ?? "-" },
  ], [t]);

  return (
    <div className="flex h-full">
      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
        {/* 헤더 */}
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <Wrench className="w-7 h-7 text-primary" />
              {t("equipment.mold.title")}
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant={showMaintenanceDue ? "primary" : "outline"} size="sm"
              onClick={handleMaintenanceDue}>
              <Calendar className="w-4 h-4 mr-1" />
              {t("equipment.mold.maintenanceDue")}
            </Button>
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              {t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => { setEditTarget(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("common.create")}
            </Button>
          </div>
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-shrink-0">
          <StatCard label={t("common.total")} value={stats.total} icon={Wrench} color="blue" />
          <StatCard label={t("equipment.normal")} value={stats.normal} icon={CheckCircle} color="green" />
          <StatCard label={t("equipment.mold.warningLabel")} value={stats.warning} icon={AlertTriangle} color="yellow" />
          <StatCard label={t("equipment.mold.overdueLabel")} value={stats.overdue} icon={XCircle} color="red" />
          <StatCard label={t("equipment.mold.retiredLabel")} value={stats.retired} icon={XCircle} color="gray" />
        </div>

        {/* DataGrid */}
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <DataGrid data={data} columns={columns} isLoading={loading}
              enableColumnFilter enableExport exportFileName={t("equipment.mold.title")}
              onRowClick={row => setSelectedRow(row as MoldMaster)}
              getRowId={row => (row as MoldMaster).moldCode}
              selectedRowId={selectedRow ? selectedRow.moldCode : undefined}
              rowClassName={row => getRowClassName(row as MoldMaster)}
              toolbarLeft={
                <div className="flex gap-3 items-center flex-1 min-w-0 flex-wrap">
                  <div className="flex-1 min-w-[180px] max-w-xs">
                    <Input placeholder={t("common.search")} value={searchText}
                      onChange={e => setSearchText(e.target.value)}
                      leftIcon={<Search className="w-4 h-4" />} fullWidth />
                  </div>
                  <div className="w-36">
                    <ComCodeSelect groupCode="MOLD_TYPE" value={typeFilter}
                      onChange={setTypeFilter} labelPrefix={t("equipment.mold.moldType")} fullWidth />
                  </div>
                  <div className="w-36">
                    <ComCodeSelect groupCode="MOLD_STATUS" value={statusFilter}
                      onChange={setStatusFilter} labelPrefix={t("equipment.mold.status")} fullWidth />
                  </div>
                </div>
              }
            />
          </CardContent>
        </Card>

        {/* 사용이력 */}
        {selectedRow && <MoldUsageList mold={selectedRow} />}
      </div>

      {/* 우측 슬라이드 패널 */}
      {isPanelOpen && (
        <MoldFormPanel
          editData={editTarget ?? (selectedRow && isPanelOpen ? selectedRow : null)}
          onClose={() => { setIsPanelOpen(false); setEditTarget(null); }}
          onSave={fetchData}
        />
      )}
    </div>
  );
}
