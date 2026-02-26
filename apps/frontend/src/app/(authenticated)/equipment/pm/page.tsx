"use client";

/**
 * @file src/app/(authenticated)/equipment/pm/page.tsx
 * @description 예방보전 페이지 - 소모성 설비 부품 관리 및 수명 모니터링
 *
 * 초보자 가이드:
 * 1. **예방보전**: 소모성 부품(금형, 지그, 공구)의 수명을 모니터링
 * 2. **수명 진행률**: 현재 사용횟수 / 예상 수명으로 진행률 표시
 * 3. API: GET /consumables
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, RefreshCw, Search, Wrench, CheckCircle, AlertTriangle, XCircle, Package } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";

interface ConsumablePart {
  id: string;
  consumableCode: string;
  consumableName: string;
  category: string;
  currentShots: number;
  expectedLife: number;
  status: string;
  equipCode: string;
}

const statusConfig: Record<string, { color: string; icon: typeof CheckCircle }> = {
  OK: { color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", icon: CheckCircle },
  NORMAL: { color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", icon: CheckCircle },
  WARNING: { color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300", icon: AlertTriangle },
  REPLACE: { color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300", icon: XCircle },
};

export default function PmPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<ConsumablePart[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<ConsumablePart | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/consumables", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statusOptions = useMemo(() => [
    { value: "", label: t("equipment.pm.allStatus") },
    { value: "OK", label: t("equipment.pm.ok") },
    { value: "WARNING", label: t("equipment.pm.warning") },
    { value: "REPLACE", label: t("equipment.pm.replace") },
  ], [t]);

  const stats = useMemo(() => ({
    total: data.length,
    ok: data.filter(d => d.status === "OK" || d.status === "NORMAL").length,
    warning: data.filter(d => d.status === "WARNING").length,
    replace: data.filter(d => d.status === "REPLACE").length,
  }), [data]);

  const columns = useMemo<ColumnDef<ConsumablePart>[]>(() => [
    {
      accessorKey: "consumableCode", header: t("common.partCode"), size: 120,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "consumableName", header: t("common.partName"), size: 150,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "category", header: t("equipment.pm.category"), size: 90,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const cat = getValue() as string;
        const labels: Record<string, string> = {
          MOLD: t("equipment.pm.mold"), JIG: t("equipment.pm.jig"), TOOL: t("equipment.pm.tool"),
        };
        return <span className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-800">{labels[cat] || cat}</span>;
      },
    },
    {
      id: "lifeProgress", header: t("equipment.pm.lifeProgress"), size: 160,
      meta: { filterType: "none" as const },
      cell: ({ row }) => {
        const { currentShots, expectedLife } = row.original;
        const pct = expectedLife > 0 ? Math.min(Math.round((currentShots / expectedLife) * 100), 100) : 0;
        const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-green-500";
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className={`${color} h-2 rounded-full`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs w-16 text-right">{currentShots}/{expectedLife}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "status", header: t("common.status"), size: 90,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const s = getValue() as string;
        const cfg = statusConfig[s] || statusConfig.OK;
        return <span className={`px-2 py-0.5 text-xs rounded font-medium ${cfg.color}`}>{s}</span>;
      },
    },
    {
      accessorKey: "equipCode", header: t("equipment.pm.equipmentCode"), size: 110,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Wrench className="w-7 h-7 text-primary" />{t("equipment.pm.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("equipment.pm.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}
          </Button>
          <Button size="sm" onClick={() => { setSelectedPart(null); setIsModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" />{t("common.add")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("equipment.pm.total")} value={stats.total} icon={Package} color="blue" />
        <StatCard label={t("equipment.pm.ok")} value={stats.ok} icon={CheckCircle} color="green" />
        <StatCard label={t("equipment.pm.warning")} value={stats.warning} icon={AlertTriangle} color="yellow" />
        <StatCard label={t("equipment.pm.replace")} value={stats.replace} icon={XCircle} color="red" />
      </div>

      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t("equipment.pm.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("common.search")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth />
              </div>
            </div>
          } />
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSelectedPart(null); }}
        title={selectedPart ? t("equipment.pm.edit") : t("equipment.pm.add")} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label={t("equipment.pm.category")}
              options={[
                { value: "MOLD", label: t("equipment.pm.mold") },
                { value: "JIG", label: t("equipment.pm.jig") },
                { value: "TOOL", label: t("equipment.pm.tool") },
              ]}
              value={selectedPart?.category || ""} fullWidth />
            <Input label={t("equipment.pm.equipmentCode")} placeholder="CRM-001"
              defaultValue={selectedPart?.equipCode} fullWidth />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
            <Button>{t("common.save")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
