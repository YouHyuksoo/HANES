"use client";

/**
 * @file components/EquipListPanel.tsx
 * @description 일일설비점검 좌측 패널 — 금일 점검 대상 설비 목록 + 상태 필터
 *
 * 초보자 가이드:
 * - status: none(미점검) / done-ok(완료PASS) / done-ng(완료FAIL)
 * - 행 클릭 → 우측 InspectEntryPanel에 해당 설비 로드
 */

import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Info, Search, ChevronRight } from "lucide-react";

export interface EquipTarget {
  equipCode: string;
  equipName: string;
  equipType: string;
  itemCount: number;
  inspectorName: string;
  overallResult: string | null;
  status: "none" | "done-ok" | "done-ng";
}

interface EquipListPanelProps {
  equipTargets: EquipTarget[];
  selectedEquipCode: string | null;
  loading: boolean;
  onSelect: (code: string) => void;
  title?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  sharedNotice?: string;
}

const STATUS_BADGE: Record<string, string> = {
  none: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  "done-ok": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  "done-ng": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const STATUS_LABEL: Record<string, string> = {
  none: "미점검",
  "done-ok": "완료(OK)",
  "done-ng": "완료(NG)",
};

export default function EquipListPanel({
  equipTargets,
  selectedEquipCode,
  loading,
  onSelect,
  title,
  searchPlaceholder,
  emptyText,
  sharedNotice,
}: EquipListPanelProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return equipTargets.filter(
      (e) =>
        (!q ||
          e.equipCode.toLowerCase().includes(q) ||
          e.equipName.toLowerCase().includes(q)) &&
        (!statusFilter || e.status === statusFilter)
    );
  }, [equipTargets, search, statusFilter]);

  const grouped = useMemo(() => {
    const groups: Record<string, EquipTarget[]> = {};
    for (const equip of filtered) {
      const key = equip.equipType || "기타";
      if (!groups[key]) groups[key] = [];
      groups[key].push(equip);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  useEffect(() => {
    if (search) {
      setExpandedGroups(new Set(grouped.map(([key]) => key)));
    }
  }, [search, grouped]);

  useEffect(() => {
    if (grouped.length > 0 && expandedGroups.size === 0 && !search) {
      setExpandedGroups(new Set(grouped.map(([key]) => key)));
    }
  }, [grouped]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const stats = useMemo(
    () => ({
      total: equipTargets.length,
      done: equipTargets.filter((e) => e.status !== "none").length,
      ng: equipTargets.filter((e) => e.status === "done-ng").length,
    }),
    [equipTargets]
  );

  return (
    <div className="bg-surface border border-border rounded-xl flex flex-col overflow-hidden shadow-sm">
      {/* 헤더 */}
      <div className="p-3 border-b border-border">
        <div className="text-sm font-semibold">
          {title ?? t("equipment.dailyInspect.todayTargets")}
        </div>
        <div className="text-xs text-text-muted mt-0.5">
          완료 {stats.done}/{stats.total}
          {stats.ng > 0 && (
            <span className="ml-2 text-red-500 font-medium">· NG {stats.ng}건</span>
          )}
        </div>
      </div>

      {/* 필터 */}
      <div className="p-2 border-b border-border flex gap-1.5">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder ?? t("equipment.dailyInspect.searchPlaceholder")}
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2 py-1.5 text-xs border border-border rounded-lg bg-background w-28 focus:outline-none"
        >
          <option value="">전체</option>
          <option value="none">미점검</option>
          <option value="done-ok">완료(OK)</option>
          <option value="done-ng">완료(NG)</option>
        </select>
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="py-8 text-center text-text-muted text-xs">{t("common.loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-text-muted text-xs">
            {emptyText ?? t("equipment.dailyInspect.noEquipFound")}
          </div>
        ) : (
          <div className="py-1 space-y-0.5">
            {grouped.map(([groupKey, equipList]) => (
              <div key={groupKey}>
                <button
                  onClick={() => toggleGroup(groupKey)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-1 text-xs font-semibold text-text hover:bg-surface transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expandedGroups.has(groupKey) ? "rotate-90" : ""}`} />
                    <span>{groupKey}</span>
                  </div>
                  <span className="text-text-muted bg-background px-1.5 py-0.5 rounded-full">{equipList.length}</span>
                </button>
                {expandedGroups.has(groupKey) && (
                  <div>
                    {equipList.map((e) => (
                      <div
                        key={e.equipCode}
                        onClick={() => onSelect(e.equipCode)}
                        className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors hover:bg-surface ${
                          selectedEquipCode === e.equipCode
                            ? "bg-primary/10 dark:bg-primary/20"
                            : ""
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold">{e.equipCode}</div>
                          <div className="text-[11px] text-text-muted truncate">{e.equipName}</div>
                        </div>
                        <div className="text-[11px] text-text-muted w-16 text-center shrink-0">
                          {e.inspectorName || "-"}
                        </div>
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded font-medium text-[11px] w-16 text-center shrink-0 ${STATUS_BADGE[e.status]}`}
                        >
                          {STATUS_LABEL[e.status]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 하단 안내 */}
      <div className="border-t border-border bg-violet-50 dark:bg-violet-950/30 px-3 py-2 text-xs text-violet-800 dark:text-violet-300 flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>{sharedNotice ?? t("equipment.dailyInspect.sharedNotice")}</span>
      </div>
    </div>
  );
}
