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
  Monitor, RefreshCw, Search,
  Wifi, Activity,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
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
    pill: "bg-sky-600 text-white border-sky-700 dark:bg-sky-500 dark:border-sky-600",
    dot: "bg-white dark:bg-white",
    pulse: true,
    glow: "hover:shadow-sky-200/60 dark:hover:shadow-sky-500/10",
  },
  MAINT: {
    pill: "bg-amber-500 text-white border-amber-600 dark:bg-amber-500 dark:border-amber-600",
    dot: "bg-white dark:bg-white",
    pulse: false,
    glow: "hover:shadow-amber-200/60 dark:hover:shadow-amber-500/10",
  },
  STOP: {
    pill: "bg-rose-600 text-white border-rose-700 dark:bg-rose-500 dark:border-rose-600",
    dot: "bg-white dark:bg-white",
    pulse: false,
    glow: "hover:shadow-rose-200/60 dark:hover:shadow-rose-500/10",
  },
  INTERLOCK: {
    pill: "bg-gray-800 text-white border-gray-900 dark:bg-gray-600 dark:border-gray-500",
    dot: "bg-red-400 dark:bg-red-400",
    pulse: true,
    glow: "hover:shadow-gray-400/60 dark:hover:shadow-gray-500/10",
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

  const resetFilters = useCallback(() => {
    setSearch("");
    setTypeFilter("");
    setLineFilter("");
    setStatusFilter("");
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Monitor className="w-7 h-7 text-primary" />
            {t("equipment.status.title")}
          </h1>
          <p className="text-text-muted mt-1">
            {t("equipment.status.subtitle", "전체 설비의 실시간 가동 현황을 확인합니다.")}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => { resetFilters(); refetch(); }}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap flex-shrink-0">
        <div className="flex-1 min-w-[200px] max-w-xs">
          <Input
            placeholder={t("common.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="w-36">
          <LineSelect value={lineFilter} onChange={setLineFilter} labelPrefix={t("master.equip.line", "라인")} fullWidth />
        </div>
        <div className="w-36">
          <ComCodeSelect groupCode="EQUIP_TYPE" value={typeFilter} onChange={setTypeFilter} labelPrefix="유형" fullWidth />
        </div>
        <div className="w-36">
          <ComCodeSelect groupCode="EQUIP_STATUS" value={statusFilter} onChange={setStatusFilter} labelPrefix="상태" fullWidth />
        </div>
      </div>

      {/* Equipment Card Grid — Control-Room Panel (라이트/다크 대응) */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-slate-100 dark:bg-slate-950 rounded-2xl p-5">
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map((equip) => {
              const s = statusStyle[equip.status] || defaultStyle;
              const hasJob = !!equip.currentJobOrderId;
              const statusLabel = t(`comCode.EQUIP_STATUS.${equip.status}`, { defaultValue: equip.status });
              const typeLabel = equip.equipType
                ? t(`comCode.EQUIP_TYPE.${equip.equipType}`, { defaultValue: equip.equipType })
                : null;

              return (
                <div
                  key={equip.equipCode}
                  className={`group rounded-lg border transition-all duration-200
                    bg-white border-slate-200/80 hover:shadow-md
                    dark:bg-slate-900 dark:border-slate-700/40 dark:hover:border-slate-600/60
                    ${s.glow}`}
                >
                  <div className="px-3 pt-3 pb-2">
                    {/* Header: Code + Status pill */}
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-bold tracking-tight leading-tight text-slate-900 dark:text-white truncate mr-2">
                        {equip.equipCode}
                      </h3>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-px shrink-0
                        rounded text-[10px] font-semibold border ${s.pill}`}
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

                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mb-2" title={equip.equipName}>
                      {equip.equipName}
                    </p>

                    {/* Metric Tiles */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="rounded px-2 py-1.5 bg-slate-50 dark:bg-slate-800/60">
                        <span className="text-[9px] uppercase tracking-wider block text-slate-400 dark:text-slate-500">
                          TYPE
                        </span>
                        <p className="text-xs font-medium mt-px truncate text-slate-700 dark:text-slate-200">
                          {typeLabel || "—"}
                        </p>
                      </div>
                      <div className="rounded px-2 py-1.5 bg-slate-50 dark:bg-slate-800/60">
                        <span className="text-[9px] uppercase tracking-wider block text-slate-400 dark:text-slate-500">
                          LINE
                        </span>
                        <p className="text-xs font-medium mt-px truncate text-slate-700 dark:text-slate-200">
                          {equip.lineCode || "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-3 py-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                    {equip.ipAddress ? (
                      <span className="text-[10px] flex items-center gap-1 font-mono text-slate-400 dark:text-slate-500">
                        <Wifi className="w-3 h-3 text-emerald-500/70 dark:text-emerald-500/60" />
                        {equip.ipAddress}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>
                    )}
                    {hasJob ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-px rounded text-[10px] font-semibold
                        bg-blue-100 text-blue-600 border border-blue-200
                        dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20"
                      >
                        <Activity className="w-3 h-3 animate-pulse" />
                        {t("equipment.status.working", "작업중")}
                      </span>
                    ) : (
                      <span className="text-[10px] flex items-center gap-1 text-slate-400 dark:text-slate-600">
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
