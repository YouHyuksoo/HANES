"use client";

/**
 * @file src/app/(authenticated)/equipment/periodic-inspect/page.tsx
 * @description 설비 정기점검 실행 화면 - 일일점검과 동일한 대상 설비 목록 + 항목별 입력 흐름
 *
 * 초보자 가이드:
 * - 좌측: PERIODIC 점검항목이 배정된 설비 목록과 해당일 처리 상태
 * - 우측: 선택 설비의 PERIODIC 점검항목별 측정값/판정 입력
 * - API: /equipment/periodic-inspect, 항목: /master/equip-inspect-items?inspectType=PERIODIC
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CalendarCheck, RefreshCw } from "lucide-react";
import api from "@/services/api";
import EquipListPanel, { type EquipTarget } from "../daily-inspect/components/EquipListPanel";
import InspectEntryPanel, { type Worker } from "../daily-inspect/components/InspectEntryPanel";
import { getTodayLocal } from "@/utils/date";

interface EquipInspectItemAssignment {
  equipCode: string;
}

interface InspectLog {
  equipCode: string;
  overallResult: string;
  inspectorName: string;
}

interface EquipMaster {
  equipCode: string;
  equipName: string;
  equipType?: string;
}

export default function PeriodicInspectPage() {
  const { t } = useTranslation();
  const today = getTodayLocal();

  const [inspectDate, setInspectDate] = useState(today);
  const [equipTargets, setEquipTargets] = useState<EquipTarget[]>([]);
  const [selectedEquipCode, setSelectedEquipCode] = useState<string | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);

  const labels = useMemo(() => ({
    selectEquip: t("equipment.periodicInspect.selectEquip", {
      defaultValue: "왼쪽 목록에서 정기점검할 설비를 선택하세요",
    }),
    inspectEntry: t("equipment.periodicInspect.inspectEntry", {
      defaultValue: "정기점검 입력",
    }),
    inspectDate: t("equipment.periodicInspect.inspectDate"),
    inspectorRequired: t("equipment.periodicInspect.inspectorRequired", {
      defaultValue: "점검자 (필수)",
    }),
    startTime: t("equipment.periodicInspect.startTime", { defaultValue: "시작 시각" }),
    noItems: t("equipment.periodicInspect.noItems", {
      defaultValue: "등록된 정기점검 항목이 없습니다",
    }),
    savedOk: t("equipment.periodicInspect.savedOk", {
      defaultValue: "정기점검이 저장되었습니다 (PASS)",
    }),
    savedNg: t("equipment.periodicInspect.savedNg", {
      defaultValue: "정기점검이 저장되었습니다 (NG)",
    }),
    saveError: t("equipment.periodicInspect.saveError", {
      defaultValue: "정기점검 저장에 실패했습니다",
    }),
    fillAllItems: t("equipment.periodicInspect.fillAllItems", {
      defaultValue: "정기점검 항목을 모두 입력하세요.",
    }),
    saveButtonPass: t("equipment.periodicInspect.saveButtonPass", {
      defaultValue: "저장 (PASS)",
    }),
    saveButtonNg: t("equipment.periodicInspect.saveButtonNg", {
      defaultValue: "저장 (NG)",
    }),
    overallTitle: t("equipment.periodicInspect.overallTitle", { defaultValue: "종합 판정" }),
    overallFailDescription: (total: number, ngCount: number) =>
      t("equipment.periodicInspect.overallFailDescription", {
        defaultValue: "{{total}}항목 중 {{ngCount}}건 NG",
        total,
        ngCount,
      }),
    overallPassDescription: (total: number) =>
      t("equipment.periodicInspect.overallPassDescription", {
        defaultValue: "전 {{total}}항목 OK",
        total,
      }),
    failLabel: t("equipment.periodicInspect.failLabel", { defaultValue: "불합격 (NG)" }),
    passLabel: t("equipment.periodicInspect.passLabel", { defaultValue: "합격 (PASS)" }),
    badRemarkPlaceholder: t("equipment.periodicInspect.badRemarkPlaceholder", {
      defaultValue: "불량 내용 입력...",
    }),
    pendingLabel: t("equipment.periodicInspect.pendingLabel", { defaultValue: "대기" }),
  }), [t]);

  const fetchTargets = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, logsRes, equipsRes] = await Promise.all([
        api.get("/master/equip-inspect-items", {
          params: { inspectType: "PERIODIC", useYn: "Y", limit: 500 },
        }),
        api.get("/equipment/periodic-inspect", {
          params: { inspectDateFrom: inspectDate, inspectDateTo: inspectDate, limit: 500 },
        }),
        api.get("/equipment/equips", { params: { limit: 500 } }),
      ]);

      const items: EquipInspectItemAssignment[] = itemsRes.data?.data ?? [];
      const logs: InspectLog[] = logsRes.data?.data ?? [];
      const equips: EquipMaster[] = equipsRes.data?.data ?? [];

      const equipCodesSet = new Set(items.map((item) => item.equipCode).filter(Boolean));
      const equipMap = new Map(equips.map((equip) => [equip.equipCode, equip]));
      const logsMap = new Map(logs.map((log) => [log.equipCode, log]));
      const countMap = new Map<string, number>();
      for (const item of items) {
        if (!item.equipCode) continue;
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
      setEquipTargets([]);
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

  const handleDateChange = (date: string) => {
    setInspectDate(date);
    setSelectedEquipCode(null);
  };

  const selectedTarget = equipTargets.find((equip) => equip.equipCode === selectedEquipCode);

  return (
    <div className="h-full flex flex-col overflow-hidden p-4 gap-3 animate-fade-in">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-primary" />
            {t("equipment.periodicInspect.title")}
          </h1>
          <p className="text-text-muted text-sm mt-0.5">
            {t("equipment.periodicInspect.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={inspectDate}
            onChange={(event) => handleDateChange(event.target.value)}
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

      <div className="flex-1 grid gap-3 min-h-0" style={{ gridTemplateColumns: "7fr 12fr" }}>
        <EquipListPanel
          equipTargets={equipTargets}
          selectedEquipCode={selectedEquipCode}
          loading={loading}
          onSelect={setSelectedEquipCode}
          title={t("equipment.periodicInspect.targets", { defaultValue: "정기점검 대상" })}
          searchPlaceholder={t("equipment.periodicInspect.searchPlaceholder")}
          emptyText={t("equipment.periodicInspect.noEquipFound", {
            defaultValue: "해당하는 정기점검 대상 설비가 없습니다",
          })}
          sharedNotice={t("equipment.periodicInspect.sharedNotice", {
            defaultValue: "설비별 PERIODIC 점검항목 기준으로 해당일 정기점검 결과를 입력합니다.",
          })}
        />
        <InspectEntryPanel
          equipCode={selectedEquipCode}
          equipName={selectedTarget?.equipName ?? ""}
          itemCount={selectedTarget?.itemCount ?? 0}
          inspectDate={inspectDate}
          workers={workers}
          inspectType="PERIODIC"
          apiBasePath="/equipment/periodic-inspect"
          labels={labels}
          existingInspected={selectedTarget ? selectedTarget.status !== "none" : false}
          onSaved={fetchTargets}
        />
      </div>
    </div>
  );
}
