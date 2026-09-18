"use client";

/**
 * @file inspection/result/components/InspectPrepGuideModal.tsx
 * @description 통전·단자검사 준비 안내 — 공용 PrepGuideModal에 이 화면의 단계 라벨·힌트·실행을 채운다.
 *
 * 초보자 가이드:
 * 1. 단계 판정은 hooks/prepGuideSteps.ts, 그리기는 components/shared/prep-guide/PrepGuideModal.
 *    이 파일은 둘을 잇는 매핑만 한다(라벨 i18n, 아이콘, 검사기·작업지시 직접 고르기 content, 나머지는 헤더와 같은 모달 열기).
 * 2. 검사기·작업지시는 안내 안에서 바로 고른다. 작업자·점검·대조는 헤더가 쓰는 같은 모달을 연다(입력 경로 두 갈래 방지).
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2, ClipboardCheck, ClipboardList, Cpu, ScanSearch, Search, UserCheck, UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui";
import { PrepGuideModal, type PrepGuideStepView } from "@/components/shared/prep-guide";
import type { Worker } from "@/components/worker/WorkerSelector";
import type { JobOrderRow } from "../types";
import type { InspectGuideStep, InspectGuideStepKey } from "../hooks/prepGuideSteps";
import type { TesterEquip } from "./InspectStationHeader";

interface InspectPrepGuideModalProps {
  open: boolean;
  steps: InspectGuideStep[];
  current: InspectGuideStep | null;
  doneCount: number;
  allReady: boolean;
  onClose: () => void;
  testers: TesterEquip[];
  equipCode: string;
  onSelectEquip: (equipCode: string) => void;
  orders: JobOrderRow[];
  selectedOrderNo: string | null;
  onSelectOrder: (order: JobOrderRow) => void;
  workers: Worker[];
  onOpenWorkerSelect: () => void;
  onOpenDailyInspect: () => void;
  onOpenWorkerInspect: () => void;
  onOpenSampleCheck: () => void;
}

const STEP_ICON: Record<InspectGuideStepKey, LucideIcon> = {
  equip: Cpu,
  worker: UserPlus,
  order: ClipboardList,
  daily: ClipboardCheck,
  workerInspect: UserCheck,
  sampleCheck: ScanSearch,
};

const STEP_LABEL_KEY: Record<InspectGuideStepKey, string> = {
  equip: "inspection.result.guide.stepEquip",
  worker: "inspection.result.guide.stepWorker",
  order: "inspection.result.guide.stepOrder",
  daily: "inspection.result.guide.stepDaily",
  workerInspect: "inspection.result.guide.stepWorkerInspect",
  sampleCheck: "inspection.result.guide.stepSampleCheck",
};

const STEP_HINT_KEY: Record<InspectGuideStepKey, string> = {
  equip: "inspection.result.guide.hintEquip",
  worker: "inspection.result.guide.hintWorker",
  order: "inspection.result.guide.hintOrder",
  daily: "inspection.result.guide.hintDaily",
  workerInspect: "inspection.result.guide.hintWorkerInspect",
  sampleCheck: "inspection.result.guide.hintSampleCheck",
};

export default function InspectPrepGuideModal({
  open,
  steps,
  current,
  doneCount,
  allReady,
  onClose,
  testers,
  equipCode,
  onSelectEquip,
  orders,
  selectedOrderNo,
  onSelectOrder,
  workers,
  onOpenWorkerSelect,
  onOpenDailyInspect,
  onOpenWorkerInspect,
  onOpenSampleCheck,
}: InspectPrepGuideModalProps) {
  const { t } = useTranslation();
  const [orderQuery, setOrderQuery] = useState("");

  const filteredOrders = useMemo(() => {
    const q = orderQuery.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      o.orderNo.toLowerCase().includes(q)
      || (o.itemName ?? "").toLowerCase().includes(q)
      || o.itemCode.toLowerCase().includes(q));
  }, [orders, orderQuery]);

  const openAction: Partial<Record<InspectGuideStepKey, () => void>> = {
    worker: onOpenWorkerSelect,
    daily: onOpenDailyInspect,
    workerInspect: onOpenWorkerInspect,
    sampleCheck: onOpenSampleCheck,
  };

  const contentOf = (key: InspectGuideStepKey) => {
    if (key === "equip") {
      return (
        <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto pr-1" data-testid="inspect-guide-equip-list">
          {testers.length === 0 && (
            <p className="col-span-2 text-sm text-text-muted">{t("inspection.result.guide.noTesters")}</p>
          )}
          {testers.map((tester) => (
            <button
              key={tester.equipCode}
              type="button"
              onClick={() => onSelectEquip(tester.equipCode)}
              className={`flex flex-col items-start rounded-lg border-2 px-3 py-2 text-left transition-colors hover:border-primary ${
                tester.equipCode === equipCode ? "border-primary" : "border-border"
              }`}
            >
              <span className="truncate text-sm font-bold text-text">{tester.equipName}</span>
              <span className="font-mono text-[11px] text-text-muted">{tester.equipCode}</span>
            </button>
          ))}
        </div>
      );
    }
    if (key === "order") {
      return (
        <div className="flex min-h-0 flex-1 flex-col gap-2" data-testid="inspect-guide-order-list">
          <Input
            placeholder={t("inspection.result.guide.searchOrder")}
            value={orderQuery}
            onChange={(e) => setOrderQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
            fullWidth
          />
          <div className="max-h-48 overflow-y-auto pr-1">
            {filteredOrders.length === 0 && (
              <p className="py-4 text-center text-sm text-text-muted">{t("common.noData")}</p>
            )}
            {filteredOrders.map((o) => (
              <button
                key={o.orderNo}
                type="button"
                onClick={() => onSelectOrder(o)}
                className={`mb-1 flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:border-primary ${
                  o.orderNo === selectedOrderNo ? "border-primary" : "border-border"
                }`}
              >
                <span className="font-mono text-sm font-bold text-text">{o.orderNo}</span>
                <span className="truncate text-xs text-text-muted">{o.itemName ?? o.itemCode}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }
    if (key === "worker" && workers.length > 0) {
      return (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {workers.map((w) => (
            <span key={w.id} className="inline-flex items-center gap-1 rounded-full border border-green-600 px-2 py-0.5 text-xs font-bold text-green-700 dark:border-green-400 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3" />
              {w.workerName}
            </span>
          ))}
        </div>
      );
    }
    return undefined;
  };

  const views: PrepGuideStepView<InspectGuideStepKey>[] = steps.map((s) => ({
    ...s,
    label: t(STEP_LABEL_KEY[s.key]),
    hint: t(STEP_HINT_KEY[s.key]),
    icon: STEP_ICON[s.key],
    action: openAction[s.key],
    content: s.status === "current" ? contentOf(s.key) : undefined,
  }));
  const currentView = current ? views.find((v) => v.key === current.key) ?? null : null;

  return (
    <PrepGuideModal
      open={open}
      title={t("inspection.result.guide.title")}
      subtitle={t("inspection.result.guide.subtitle")}
      allReadyDesc={t("inspection.result.guide.allReadyDesc")}
      steps={views}
      current={currentView}
      doneCount={doneCount}
      allReady={allReady}
      onClose={onClose}
      testIdPrefix="inspect-guide"
    />
  );
}
