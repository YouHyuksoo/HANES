"use client";

/**
 * @file src/app/(authenticated)/master/process-capa/page.tsx
 * @description 공정 CAPA 관리 페이지 - 공정x제품별 생산능력 마스터
 *
 * 초보자 가이드:
 * 1. StatCard 4개로 전체/설비종속/인력종속/비활성 건수 표시
 * 2. DataGrid에서 공정필터 + 검색으로 필터링
 * 3. 행 클릭 시 우측 CapaFormPanel 슬라이드 열림
 * 4. 신규/수정/삭제 CRUD 지원
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  Gauge, RefreshCw, Plus, Search as SearchIcon,
  BarChart3, Users, Cpu, XCircle,
} from "lucide-react";
import {
  Card, CardContent, Button, Input, Select,
  StatCard, ConfirmModal,
} from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import CapaFormPanel from "./components/CapaFormPanel";

/** 공정 CAPA 마스터 아이템 */
interface ProcessCapaItem {
  processCode: string;
  itemCode: string;
  stdTactTime: number;
  stdUph: number;
  workerCnt: number;
  boardCnt: number;
  equipCnt: number;
  setupTime: number;
  balanceEff: number;
  dailyCapa: number;
  useYn: string;
  remark?: string | null;
  process?: { processCode: string; processName: string } | null;
  part?: { itemCode: string; itemName: string } | null;
}

export default function ProcessCapaPage() {
  const { t } = useTranslation();

  /* -- 데이터 상태 -- */
  const [data, setData] = useState<ProcessCapaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [processFilter, setProcessFilter] = useState("");

  /* -- 패널/모달 상태 -- */
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProcessCapaItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProcessCapaItem | null>(null);

  /* -- 공정 옵션 -- */
  const [processOptions, setProcessOptions] = useState<
    { value: string; label: string }[]
  >([]);

  /* -- 공정 옵션 로드 -- */
  const fetchProcessOptions = useCallback(async () => {
    try {
      const res = await api.get("/master/processes", {
        params: { limit: "5000" },
      });
      const list = res.data?.data ?? [];
      setProcessOptions([
        { value: "", label: t("common.all") },
        ...list.map((p: { processCode: string; processName: string }) => ({
          value: p.processCode,
          label: `${p.processCode} - ${p.processName}`,
        })),
      ]);
    } catch {
      setProcessOptions([{ value: "", label: t("common.all") }]);
    }
  }, [t]);

  /* -- 데이터 조회 -- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (processFilter) params.processCode = processFilter;
      const res = await api.get("/master/process-capas", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, processFilter]);

  useEffect(() => {
    fetchProcessOptions();
  }, [fetchProcessOptions]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* -- 통계 -- */
  const stats = useMemo(() => {
    const total = data.length;
    const equipBased = data.filter((d) => d.equipCnt > 0).length;
    const workerBased = data.filter((d) => d.workerCnt > 0).length;
    const inactive = data.filter((d) => d.useYn === "N").length;
    return { total, equipBased, workerBased, inactive };
  }, [data]);

  /* -- 행 클릭 -- */
  const handleRowClick = useCallback((row: ProcessCapaItem) => {
    setEditingItem(row);
    setIsPanelOpen(true);
  }, []);

  /* -- 신규 추가 -- */
  const handleAdd = useCallback(() => {
    setEditingItem(null);
    setIsPanelOpen(true);
  }, []);

  /* -- 삭제 확인 -- */
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(
        `/master/process-capas/${deleteTarget.processCode}/${deleteTarget.itemCode}`,
      );
      setDeleteTarget(null);
      fetchData();
    } catch {
      /* api interceptor handles */
    }
  }, [deleteTarget, fetchData]);

  /* -- 저장 후 콜백 -- */
  const handleSave = useCallback(() => {
    setIsPanelOpen(false);
    setEditingItem(null);
    fetchData();
  }, [fetchData]);

  /* -- 컬럼 정의 -- */
  const columns = useMemo<ColumnDef<ProcessCapaItem>[]>(
    () => [
      {
        accessorKey: "process.processName",
        header: t("processCapa.processCode"),
        size: 140,
        accessorFn: (row) => row.process?.processName ?? row.processCode,
      },
      { accessorKey: "itemCode", header: t("processCapa.itemCode"), size: 140 },
      {
        id: "itemName",
        header: t("common.partName"),
        size: 180,
        accessorFn: (row) => row.part?.itemName ?? "-",
      },
      {
        accessorKey: "stdTactTime",
        header: t("processCapa.stdTactTime"),
        size: 110,
        meta: { align: "right" as const },
      },
      {
        accessorKey: "stdUph",
        header: t("processCapa.stdUph"),
        size: 100,
        meta: { align: "right" as const },
      },
      {
        accessorKey: "workerCnt",
        header: t("processCapa.workerCnt"),
        size: 90,
        meta: { align: "right" as const },
      },
      {
        accessorKey: "boardCnt",
        header: t("processCapa.boardCnt"),
        size: 100,
        meta: { align: "right" as const },
      },
      {
        accessorKey: "equipCnt",
        header: t("processCapa.equipCnt"),
        size: 90,
        meta: { align: "right" as const },
      },
      {
        accessorKey: "balanceEff",
        header: t("processCapa.balanceEff"),
        size: 110,
        meta: { align: "right" as const },
        cell: ({ getValue }) => `${getValue()}%`,
      },
      {
        accessorKey: "dailyCapa",
        header: t("processCapa.dailyCapa"),
        size: 100,
        meta: { align: "right" as const },
        cell: ({ getValue }) => (
          <span className="font-semibold text-primary">
            {Number(getValue()).toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: "useYn",
        header: t("common.active"),
        size: 80,
        meta: { align: "center" as const },
        cell: ({ getValue }) => (
          <span
            className={
              getValue() === "Y"
                ? "text-green-600 dark:text-green-400"
                : "text-red-500 dark:text-red-400"
            }
          >
            {getValue() === "Y" ? "Y" : "N"}
          </span>
        ),
      },
    ],
    [t],
  );

  return (
    <div className="flex h-full">
      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
        {/* 헤더 */}
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <Gauge className="w-7 h-7 text-primary" />
              {t("processCapa.title")}
            </h1>
            <p className="text-text-muted mt-1">
              {t("processCapa.description")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw
                className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`}
              />
              {t("common.refresh")}
            </Button>
            <Button size="sm" onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-1" />
              {t("processCapa.addCapa")}
            </Button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
          <StatCard
            label={t("processCapa.stats.total")}
            value={stats.total}
            icon={BarChart3}
            color="blue"
          />
          <StatCard
            label={t("processCapa.stats.equipBased")}
            value={stats.equipBased}
            icon={Cpu}
            color="purple"
          />
          <StatCard
            label={t("processCapa.stats.workerBased")}
            value={stats.workerBased}
            icon={Users}
            color="green"
          />
          <StatCard
            label={t("processCapa.stats.inactive")}
            value={stats.inactive}
            icon={XCircle}
            color="red"
          />
        </div>

        {/* DataGrid */}
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <DataGrid
              data={data}
              columns={columns}
              isLoading={loading}
              onRowClick={handleRowClick}
              enableColumnFilter
              enableExport
              exportFileName={t("processCapa.title")}
              getRowId={(row) =>
                `${(row as ProcessCapaItem).processCode}_${(row as ProcessCapaItem).itemCode}`
              }
              toolbarLeft={
                <div className="flex gap-3 items-center flex-1 min-w-0">
                  <Select
                    options={processOptions}
                    value={processFilter}
                    onChange={setProcessFilter}
                    className="w-48 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-[180px]">
                    <Input
                      placeholder={t("common.search")}
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      leftIcon={<SearchIcon className="w-4 h-4" />}
                      fullWidth
                    />
                  </div>
                </div>
              }
            />
          </CardContent>
        </Card>

        {/* 삭제 확인 */}
        <ConfirmModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
          title={t("common.deleteConfirm", { defaultValue: "삭제 확인" })}
          message={`${deleteTarget?.processCode} / ${deleteTarget?.itemCode} ${t("common.deleteMessage", { defaultValue: "을(를) 삭제하시겠습니까?" })}`}
          confirmText={t("common.delete")}
          variant="danger"
        />
      </div>

      {/* 우측 폼 패널 */}
      {isPanelOpen && (
        <CapaFormPanel
          editingItem={editingItem}
          onClose={() => {
            setIsPanelOpen(false);
            setEditingItem(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
