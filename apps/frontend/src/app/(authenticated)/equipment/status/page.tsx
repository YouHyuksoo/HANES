"use client";

/**
 * @file src/app/(authenticated)/equipment/status/page.tsx
 * @description 설비 가동현황 페이지 — 컨트롤룸 스타일 카드 그리드 (라이트/다크 대응)
 *
 * 초보자 가이드:
 * 1. **카드 그리드**: 설비별 상태(정상/점검/정지)를 카드로 표시
 * 2. **필터**: 라인, 설비유형, 상태, 검색어
 * 3. **StatCards**: 전체/정상/점검/정지 건수 표시
 * 4. API: GET /equipment/equips
 */

import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Monitor, RefreshCw, Search, CheckCircle, AlertTriangle,
  XCircle, Wifi, Activity,
} from "lucide-react";
import { Button, Input, StatCard } from "@/components/ui";
import { ComCodeSelect, LineSelect } from "@/components/shared";
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

/** 상태별 스타일 — 라이트/다크 모드 각각 대응 */
const statusStyle: Record<string, {
  pill: string; dot: string; pulse: boolean; glow: string;
}> = {
  NORMAL: {
    pill: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/25",
    dot: "bg-emerald-500 dark:bg-emerald-400",
    pulse: true,
    glow: "hover:shadow-emerald-200/60 dark:hover:shadow-emerald-500/10",
  },
  MAINT: {
    pill: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/25",
    dot: "bg-amber-500 dark:bg-amber-400",
    pulse: false,
    glow: "hover:shadow-amber-200/60 dark:hover:shadow-amber-500/10",
  },
  STOP: {
    pill: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/25",
    dot: "bg-rose-500 dark:bg-rose-400",
    pulse: false,
    glow: "hover:shadow-rose-200/60 dark:hover:shadow-rose-500/10",
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
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>
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
          <LineSelect value={lineFilter} onChange={setLineFilter} fullWidth />
        </div>
        <div className="w-36">
          <ComCodeSelect groupCode="EQUIP_TYPE" value={typeFilter} onChange={setTypeFilter} fullWidth />
        </div>
        <div className="w-36">
          <ComCodeSelect groupCode="EQUIP_STATUS" value={statusFilter} onChange={setStatusFilter} fullWidth />
        </div>
        <Button variant="ghost" size="sm" onClick={resetFilters}>{t("common.reset")}</Button>
      </div>

      {/* Equipment Card Grid — Control-Room Panel (라이트/다크 대응) */}
      <div className="bg-slate-100 dark:bg-slate-950 rounded-2xl p-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Monitor className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
            <p className="text-sm text-slate-400 dark:text-slate-500">
              {t("equipment.status.noEquip", "표시할 설비가 없습니다.")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((equip) => {
              const s = statusStyle[equip.status] || defaultStyle;
              const hasJob = !!equip.currentJobOrderId;
              const statusLabel = t(`comCode.EQUIP_STATUS.${equip.status}`, { defaultValue: equip.status });
              const typeLabel = equip.equipType
                ? t(`comCode.EQUIP_TYPE.${equip.equipType}`, { defaultValue: equip.equipType })
                : null;

              return (
                <div
                  key={equip.id}
                  className={`group rounded-xl border transition-all duration-300
                    bg-white border-slate-200/80 hover:shadow-xl
                    dark:bg-slate-900 dark:border-slate-700/40 dark:hover:border-slate-600/60
                    ${s.glow} hover:shadow-2xl`}
                >
                  <div className="p-5">
                    {/* Header: Label + Status pill */}
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                        EQUIP ID
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5
                        rounded-full text-[11px] font-semibold border ${s.pill}`}
                      >
                        <span className="relative flex h-1.5 w-1.5">
                          {s.pulse && (
                            <span className={`animate-ping absolute h-full w-full rounded-full ${s.dot} opacity-60`} />
                          )}
                          <span className={`relative rounded-full h-1.5 w-1.5 ${s.dot}`} />
                        </span>
                        {statusLabel}
                      </span>
                    </div>

                    {/* Equipment Code — Bold mono */}
                    <h3 className="text-xl font-extrabold font-mono tracking-tight leading-tight text-slate-900 dark:text-white">
                      {equip.equipCode}
                    </h3>
                    <p className="text-[13px] mt-0.5 mb-4 truncate text-slate-500 dark:text-slate-400" title={equip.equipName}>
                      {equip.equipName}
                    </p>

                    {/* Metric Tiles */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60">
                        <span className="text-[9px] uppercase tracking-wider block text-slate-400 dark:text-slate-500">
                          TYPE
                        </span>
                        <p className="text-sm font-semibold mt-0.5 truncate text-slate-700 dark:text-slate-200">
                          {typeLabel || "—"}
                        </p>
                      </div>
                      <div className="rounded-lg px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60">
                        <span className="text-[9px] uppercase tracking-wider block text-slate-400 dark:text-slate-500">
                          LINE
                        </span>
                        <p className="text-sm font-semibold mt-0.5 truncate text-slate-700 dark:text-slate-200">
                          {equip.lineCode || "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                    {equip.ipAddress ? (
                      <span className="text-[11px] flex items-center gap-1.5 font-mono text-slate-400 dark:text-slate-500">
                        <Wifi className="w-3 h-3 text-emerald-500/70 dark:text-emerald-500/60" />
                        {equip.ipAddress}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-300 dark:text-slate-600">—</span>
                    )}
                    {hasJob ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold
                        bg-blue-100 text-blue-600 border border-blue-200
                        dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20"
                      >
                        <Activity className="w-3 h-3 animate-pulse" />
                        {t("equipment.status.working", "작업중")}
                      </span>
                    ) : (
                      <span className="text-[11px] flex items-center gap-1 text-slate-400 dark:text-slate-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                        Idle
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
