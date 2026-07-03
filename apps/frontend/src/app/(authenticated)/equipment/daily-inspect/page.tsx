"use client";

/**
 * @file equipment/daily-inspect/page.tsx
 * @description 일일설비점검 별도 등록 — 설비 목록(좌) + 항목 인라인 입력(우) 분할 패널
 *
 * 초보자 가이드:
 * - 설비관리자가 사무실에서 다수 설비를 한 번에 처리하거나 누락분 보정에 사용
 * - 작업실적 화면 팝업과 동일한 DB 테이블 공유 (EquipInspectLogs)
 * - 좌측: 금일 점검 대상 설비 목록 (미점검/완료 상태 표시)
 * - 우측: 선택 설비의 항목별 점검 결과 인라인 입력
 */

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardCheck, RefreshCw } from "lucide-react";
import api from "@/services/api";
import EquipListPanel, { type EquipTarget } from "./components/EquipListPanel";
import InspectEntryPanel from "./components/InspectEntryPanel";
import { getTodayLocal } from "@/utils/date";

export interface Worker {
  workerCode: string;
  workerName: string;
  dept: string;
}

export default function DailyInspectPage() {
  const { t } = useTranslation();
  const today = getTodayLocal();

  const [inspectDate, setInspectDate] = useState(today);
  const [equipTargets, setEquipTargets] = useState<EquipTarget[]>([]);
  const [selectedEquipCode, setSelectedEquipCode] = useState<string | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTargets = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, logsRes, equipsRes] = await Promise.all([
        api.get("/master/equip-inspect-items", {
          params: { inspectType: "DAILY", useYn: "Y", limit: 500 },
        }),
        api.get("/equipment/daily-inspect", {
          params: { inspectDateFrom: inspectDate, inspectDateTo: inspectDate, limit: 500 },
        }),
        api.get("/equipment/equips", { params: { limit: 500 } }),
      ]);

      const items: { equipCode: string }[] = itemsRes.data?.data ?? [];
      const logs: { equipCode: string; overallResult: string; inspectorName: string }[] =
        logsRes.data?.data ?? [];
      const equips: { equipCode: string; equipName: string; equipType?: string }[] =
        equipsRes.data?.data ?? [];

      const equipCodesSet = new Set(items.map((i) => i.equipCode));
      const equipMap = new Map(equips.map((e) => [e.equipCode, e]));
      const logsMap = new Map(logs.map((l) => [l.equipCode, l]));
      const countMap = new Map<string, number>();
      for (const item of items) {
        countMap.set(item.equipCode, (countMap.get(item.equipCode) ?? 0) + 1);
      }

      const targets: EquipTarget[] = Array.from(equipCodesSet).map((code) => {
        const log = logsMap.get(code);
        const equip = equipMap.get(code);
        return {
          equipCode: code,
          equipName: equip?.equipName ?? code,
          equipType: equip?.equipType ?? "",
          itemCount: countMap.get(code) ?? 0,
          inspectorName: log?.inspectorName ?? "",
          overallResult: log?.overallResult ?? null,
          status: log
            ? log.overallResult === "FAIL"
              ? "done-ng"
              : "done-ok"
            : "none",
        };
      });

      setEquipTargets(targets.sort((a, b) => a.equipCode.localeCompare(b.equipCode)));
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [inspectDate]);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .get("/master/workers", { params: { limit: 200, useYn: "Y" }, signal: ctrl.signal })
      .then((res) => setWorkers(res.data?.data ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  const handleDateChange = (d: string) => {
    setInspectDate(d);
    setSelectedEquipCode(null);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden p-4 gap-3 animate-fade-in">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-primary" />
            {t("equipment.dailyInspect.title")}
          </h1>
          <p className="text-text-muted text-sm mt-0.5">
            {t("equipment.dailyInspect.pageSubtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={inspectDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:border-primary"
          />
          <button
            onClick={fetchTargets}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg bg-surface hover:bg-surface/80 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </button>
        </div>
      </div>

      <div className="flex-1 grid gap-3 min-h-0" style={{ gridTemplateColumns: "6fr 7fr" }}>
        <EquipListPanel
          equipTargets={equipTargets}
          selectedEquipCode={selectedEquipCode}
          loading={loading}
          onSelect={setSelectedEquipCode}
        />
        <InspectEntryPanel
          equipCode={selectedEquipCode}
          equipName={
            equipTargets.find((e) => e.equipCode === selectedEquipCode)?.equipName ?? ""
          }
          itemCount={
            equipTargets.find((e) => e.equipCode === selectedEquipCode)?.itemCount ?? 0
          }
          inspectDate={inspectDate}
          workers={workers}
          onSaved={fetchTargets}
        />
      </div>
    </div>
  );
}
