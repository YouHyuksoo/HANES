"use client";

/**
 * @file src/app/(authenticated)/equipment/status/page.tsx
 * @description 설비 가동현황 페이지 — 전체 설비를 카드형태로 실시간 표시
 *
 * 초보자 가이드:
 * 1. **카드 그리드**: 설비별 상태(정상/점검/정지)를 색상 카드로 표시
 * 2. **필터**: 라인, 설비유형, 상태, 검색어
 * 3. **StatCards**: 전체/정상/점검/정지 건수 표시
 * 4. API: GET /equipment/equips
 */

import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Monitor, RefreshCw, Search, CheckCircle, AlertTriangle,
  XCircle, Settings, Wifi, WifiOff, Cpu,
} from "lucide-react";
import { Button, Input, Select, StatCard, ComCodeBadge } from "@/components/ui";
import { useComCodeOptions } from "@/hooks/useComCode";
import { useApiQuery } from "@/hooks/useApi";

interface EquipCard {
  id: string;
  equipCode: string;
  equipName: string;
  equipType: string | null;
  lineCode: string | null;
  status: string;
  ipAddress: string | null;
  modelName: string | null;
  maker: string | null;
  currentJobOrderId: string | null;
}

const statusStyle: Record<string, {
  border: string; bg: string; icon: typeof CheckCircle; iconColor: string; pulse: string;
}> = {
  NORMAL: {
    border: "border-green-300 dark:border-green-700",
    bg: "bg-green-50 dark:bg-green-900/10",
    icon: CheckCircle,
    iconColor: "text-green-500",
    pulse: "bg-green-500",
  },
  MAINT: {
    border: "border-yellow-300 dark:border-yellow-700",
    bg: "bg-yellow-50 dark:bg-yellow-900/10",
    icon: AlertTriangle,
    iconColor: "text-yellow-500",
    pulse: "bg-yellow-500",
  },
  STOP: {
    border: "border-red-300 dark:border-red-700",
    bg: "bg-red-50 dark:bg-red-900/10",
    icon: XCircle,
    iconColor: "text-red-500",
    pulse: "bg-red-500",
  },
};

const defaultStyle = statusStyle.NORMAL;

export default function EquipStatusPage() {
  const { t } = useTranslation();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [lineFilter, setLineFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: response, isLoading, refetch } = useApiQuery<any>(
    ["equipment", "list"],
    "/equipment/equips?limit=500",
    { refetchInterval: 30000 },
  );
  const equipments: EquipCard[] = response?.data ?? [];

  const equipTypeOpts = useComCodeOptions("EQUIP_TYPE");
  const equipStatusOpts = useComCodeOptions("EQUIP_STATUS");

  const lineOptions = useMemo(() => {
    const lines = [...new Set(equipments.map((e) => e.lineCode).filter(Boolean))] as string[];
    lines.sort();
    return [{ value: "", label: t("equipment.status.allLines") }, ...lines.map((l) => ({ value: l, label: l }))];
  }, [equipments, t]);

  const typeFilterOpts = useMemo(() => [
    { value: "", label: t("equipment.status.allTypes") },
    ...equipTypeOpts,
  ], [t, equipTypeOpts]);

  const statusFilterOpts = useMemo(() => [
    { value: "", label: t("common.allStatus") },
    ...equipStatusOpts,
  ], [t, equipStatusOpts]);

  const filtered = useMemo(() => {
    let list = equipments;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((e) =>
        e.equipCode.toLowerCase().includes(s) ||
        e.equipName.toLowerCase().includes(s),
      );
    }
    if (typeFilter) list = list.filter((e) => e.equipType === typeFilter);
    if (lineFilter) list = list.filter((e) => e.lineCode === lineFilter);
    if (statusFilter) list = list.filter((e) => e.status === statusFilter);
    return list;
  }, [equipments, search, typeFilter, lineFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const normal = filtered.filter((e) => e.status === "NORMAL").length;
    const maint = filtered.filter((e) => e.status === "MAINT").length;
    const stop = filtered.filter((e) => e.status === "STOP").length;
    return { total, normal, maint, stop };
  }, [filtered]);

  const resetFilters = useCallback(() => {
    setSearch("");
    setTypeFilter("");
    setLineFilter("");
    setStatusFilter("");
  }, []);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Monitor className="w-7 h-7 text-primary" />
            {t("equipment.status.title")}
          </h1>
          <p className="text-text-muted mt-1">
            {t("equipment.status.subtitle", "전체 설비의 실시간 가동 현황을 확인합니다.")}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("common.total")} value={stats.total} icon={Monitor} color="blue" />
        <StatCard label={t("equipment.normal")} value={stats.normal} icon={CheckCircle} color="green" />
        <StatCard label={t("equipment.maint")} value={stats.maint} icon={AlertTriangle} color="yellow" />
        <StatCard label={t("equipment.stop")} value={stats.stop} icon={XCircle} color="red" />
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="flex-1 min-w-[200px] max-w-xs">
          <Input
            placeholder={t("common.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="w-36">
          <Select options={lineOptions} value={lineFilter} onChange={setLineFilter} fullWidth />
        </div>
        <div className="w-36">
          <Select options={typeFilterOpts} value={typeFilter} onChange={setTypeFilter} fullWidth />
        </div>
        <div className="w-36">
          <Select options={statusFilterOpts} value={statusFilter} onChange={setStatusFilter} fullWidth />
        </div>
        <Button variant="ghost" size="sm" onClick={resetFilters}>{t("common.reset")}</Button>
      </div>

      {/* Equipment Card Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-text-muted">
          <Monitor className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t("equipment.status.noEquip", "표시할 설비가 없습니다.")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {filtered.map((equip) => {
            const style = statusStyle[equip.status] || defaultStyle;
            const StatusIcon = style.icon;
            return (
              <div
                key={equip.id}
                className={`relative rounded-xl border-2 ${style.border} ${style.bg} p-4 transition-all hover:shadow-lg hover:scale-[1.02] cursor-default`}
              >
                {/* Pulse indicator */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  {equip.status === "NORMAL" && (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${style.pulse} opacity-75`} />
                      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${style.pulse}`} />
                    </span>
                  )}
                  {equip.status !== "NORMAL" && (
                    <span className={`inline-flex rounded-full h-2.5 w-2.5 ${style.pulse}`} />
                  )}
                </div>

                {/* Status icon + code */}
                <div className="flex items-center gap-2 mb-2">
                  <StatusIcon className={`w-5 h-5 ${style.iconColor}`} />
                  <span className="font-mono text-sm font-bold text-text">{equip.equipCode}</span>
                </div>

                {/* Name */}
                <p className="text-xs text-text font-medium mb-3 truncate" title={equip.equipName}>
                  {equip.equipName}
                </p>

                {/* Info rows */}
                <div className="space-y-1.5">
                  {equip.equipType && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-text-muted">{t("equipment.type")}</span>
                      <ComCodeBadge groupCode="EQUIP_TYPE" code={equip.equipType} />
                    </div>
                  )}
                  {equip.lineCode && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-text-muted">{t("equipment.line")}</span>
                      <span className="text-xs font-mono font-medium text-text">{equip.lineCode}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-text-muted">{t("common.status")}</span>
                    <ComCodeBadge groupCode="EQUIP_STATUS" code={equip.status} />
                  </div>
                  {equip.ipAddress && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-text-muted">IP</span>
                      <div className="flex items-center gap-1">
                        <Wifi className="w-3 h-3 text-green-500" />
                        <span className="text-[10px] font-mono text-text-muted">{equip.ipAddress}</span>
                      </div>
                    </div>
                  )}
                  {!equip.ipAddress && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-text-muted">IP</span>
                      <div className="flex items-center gap-1">
                        <WifiOff className="w-3 h-3 text-gray-400" />
                        <span className="text-[10px] text-text-muted">-</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Job order indicator */}
                {equip.currentJobOrderId && (
                  <div className="mt-3 pt-2 border-t border-border/50">
                    <div className="flex items-center gap-1.5">
                      <Cpu className="w-3 h-3 text-blue-500" />
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium truncate">
                        {t("equipment.status.working", "작업중")}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
