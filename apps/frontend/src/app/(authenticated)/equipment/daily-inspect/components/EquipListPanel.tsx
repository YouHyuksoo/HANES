"use client";

/**
 * @file components/EquipListPanel.tsx
 * @description 일일설비점검 좌측 패널 — 금일 점검 대상 설비 목록 + 상태 필터
 *
 * 초보자 가이드:
 * - status: none(미점검) / done-ok(완료PASS) / done-ng(완료FAIL)
 * - 행 클릭 → 우측 InspectEntryPanel에 해당 설비 로드
 */

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Info, Search } from "lucide-react";

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
}: EquipListPanelProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

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
          {t("equipment.dailyInspect.todayTargets")}
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
            placeholder={t("equipment.dailyInspect.searchPlaceholder")}
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
            {t("equipment.dailyInspect.noEquipFound")}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-text-muted">설비</th>
                <th className="px-2 py-2 text-center font-medium text-text-muted w-20">점검자</th>
                <th className="px-2 py-2 text-center font-medium text-text-muted w-24">상태</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr
                  key={e.equipCode}
                  onClick={() => onSelect(e.equipCode)}
                  className={`border-b border-border cursor-pointer transition-colors hover:bg-surface ${
                    selectedEquipCode === e.equipCode
                      ? "bg-primary/10 dark:bg-primary/20"
                      : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <div className="font-semibold">{e.equipCode}</div>
                    <div className="text-text-muted mt-0.5">{e.equipName}</div>
                  </td>
                  <td className="px-2 py-2 text-center text-text-muted">
                    {e.inspectorName || "-"}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded font-medium ${STATUS_BADGE[e.status]}`}
                    >
                      {STATUS_LABEL[e.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 하단 안내 */}
      <div className="border-t border-border bg-violet-50 dark:bg-violet-950/30 px-3 py-2 text-xs text-violet-800 dark:text-violet-300 flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>{t("equipment.dailyInspect.sharedNotice")}</span>
      </div>
    </div>
  );
}
