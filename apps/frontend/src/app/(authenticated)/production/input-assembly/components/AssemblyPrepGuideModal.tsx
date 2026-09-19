"use client";

/**
 * @file production/input-assembly/components/AssemblyPrepGuideModal.tsx
 * @description 실적입력(조립) 준비 안내 — 공용 PrepGuideModal에 이 화면의 단계 라벨·힌트·실행을 채운다.
 *
 * 초보자 가이드:
 * 1. 단계 판정은 ../assemblyPrepGuideSteps.ts, 그리기는 components/shared/prep-guide/PrepGuideModal.
 * 2. 단계 라벨·힌트는 실적입력(가공) 키오스크와 같은 kiosk.guide.* 문구를 재사용한다(같은 준비 동작).
 *    제목·부제·완료 문구만 조립 화면 것(production.inputAssembly.guide.*)을 쓴다.
 * 3. 모든 실행은 상단 바가 쓰는 같은 모달(설비 선택·작업지시·작업자·점검)을 연다.
 */
import { useTranslation } from "react-i18next";
import { CheckCircle2, ClipboardList, Cpu, ShieldCheck, ShoppingCart, UserCheck, UserPlus, type LucideIcon } from "lucide-react";
import { PrepGuideModal, type PrepGuideStepView } from "@/components/shared/prep-guide";
import type { AssemblyGuideStep, AssemblyGuideStepKey } from "../assemblyPrepGuideSteps";

interface AssemblyPrepGuideModalProps {
  open: boolean;
  steps: AssemblyGuideStep[];
  current: AssemblyGuideStep | null;
  doneCount: number;
  allReady: boolean;
  onClose: () => void;
  workerNames: string[];
  onOpenEquipSelect: () => void;
  onOpenJobOrder: () => void;
  onOpenWorker: () => void;
  onOpenDailyInspect: () => void;
  onOpenWorkerInspect: () => void;
  onFocusCarrier: () => void;
}

const STEP_ICON: Record<AssemblyGuideStepKey, LucideIcon> = {
  equip: Cpu,
  jobOrder: ClipboardList,
  worker: UserPlus,
  daily: ShieldCheck,
  workerInspect: UserCheck,
  carrier: ShoppingCart,
};

const STEP_LABEL_KEY: Record<AssemblyGuideStepKey, string> = {
  equip: "kiosk.guide.stepEquip",
  jobOrder: "kiosk.guide.stepJobOrder",
  worker: "kiosk.guide.stepWorker",
  daily: "kiosk.guide.stepDaily",
  workerInspect: "kiosk.guide.stepWorkerInspect",
  carrier: "production.inputAssembly.guide.stepCarrier",
};

const STEP_HINT_KEY: Record<AssemblyGuideStepKey, string> = {
  equip: "production.inputAssembly.guide.hintEquip",
  jobOrder: "production.inputAssembly.guide.hintJobOrder",
  worker: "kiosk.guide.hintWorker",
  daily: "kiosk.guide.hintDaily",
  workerInspect: "kiosk.guide.hintWorkerInspect",
  carrier: "production.inputAssembly.guide.hintCarrier",
};

export default function AssemblyPrepGuideModal({
  open,
  steps,
  current,
  doneCount,
  allReady,
  onClose,
  workerNames,
  onOpenEquipSelect,
  onOpenJobOrder,
  onOpenWorker,
  onOpenDailyInspect,
  onOpenWorkerInspect,
  onFocusCarrier,
}: AssemblyPrepGuideModalProps) {
  const { t } = useTranslation();

  const openAction: Record<AssemblyGuideStepKey, () => void> = {
    equip: onOpenEquipSelect,
    jobOrder: onOpenJobOrder,
    worker: onOpenWorker,
    daily: onOpenDailyInspect,
    workerInspect: onOpenWorkerInspect,
    carrier: onFocusCarrier,
  };

  const views: PrepGuideStepView<AssemblyGuideStepKey>[] = steps.map((s) => ({
    ...s,
    label: t(STEP_LABEL_KEY[s.key]),
    hint: t(STEP_HINT_KEY[s.key]),
    icon: STEP_ICON[s.key],
    action: openAction[s.key],
    content: s.status === "current" && s.key === "worker" && workerNames.length > 0 ? (
      <div className="mb-3 flex flex-wrap gap-1.5">
        {workerNames.map((name) => (
          <span key={name} className="inline-flex items-center gap-1 rounded-full border border-green-600 px-2 py-0.5 text-xs font-bold text-green-700 dark:border-green-400 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3" />
            {name}
          </span>
        ))}
      </div>
    ) : undefined,
  }));
  const currentView = current ? views.find((v) => v.key === current.key) ?? null : null;

  return (
    <PrepGuideModal
      open={open}
      title={t("production.inputAssembly.guide.title")}
      subtitle={t("production.inputAssembly.guide.subtitle")}
      allReadyDesc={t("production.inputAssembly.guide.allReadyDesc")}
      steps={views}
      current={currentView}
      doneCount={doneCount}
      allReady={allReady}
      onClose={onClose}
      testIdPrefix="assembly-guide"
    />
  );
}
