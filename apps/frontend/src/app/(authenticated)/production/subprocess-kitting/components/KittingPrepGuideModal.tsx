"use client";

/**
 * @file production/subprocess-kitting/components/KittingPrepGuideModal.tsx
 * @description 실적입력(서브공정) 준비 안내 — 공용 PrepGuideModal 에 이 화면의 단계 라벨·힌트·실행을 채운다.
 *
 * 초보자 가이드:
 * 1. 단계 판정은 ../kittingPrepGuideSteps.ts, 그리기는 components/shared/prep-guide/PrepGuideModal.
 * 2. 단계 라벨·힌트는 실적입력(가공)·(조립)과 같은 문구를 재사용한다(같은 준비 동작).
 *    제목·부제·완료 문구와 회로 단계만 이 화면 것(production.subprocess.guide.*)을 쓴다.
 * 3. 모든 실행은 화면이 이미 쓰는 같은 모달(설비 선택·작업지시·작업자·점검)을 연다.
 *    회로는 모달이 없고 상단 바 select 라서 포커스를 옮긴다.
 * 4. A안·B안이 같은 컨트롤러(useSubprocessKittingController)의 guide 를 쓰므로 이 모달도 둘이 공유한다.
 */
import { useTranslation } from "react-i18next";
import { CheckCircle2, ClipboardList, Cpu, ShieldCheck, ShoppingCart, UserCheck, UserPlus, Waypoints, type LucideIcon } from "lucide-react";
import { PrepGuideModal, type PrepGuideStepView } from "@/components/shared/prep-guide";
import type { KittingGuideStep, KittingGuideStepKey } from "../kittingPrepGuideSteps";

interface KittingPrepGuideModalProps {
  open: boolean;
  steps: KittingGuideStep[];
  current: KittingGuideStep | null;
  doneCount: number;
  allReady: boolean;
  onClose: () => void;
  workerNames: string[];
  onOpenEquipSelect: () => void;
  onOpenJobOrder: () => void;
  onOpenWorker: () => void;
  onOpenDailyInspect: () => void;
  onOpenWorkerInspect: () => void;
  onFocusCircuit: () => void;
  onFocusCarrier: () => void;
}

const STEP_ICON: Record<KittingGuideStepKey, LucideIcon> = {
  equip: Cpu,
  jobOrder: ClipboardList,
  circuit: Waypoints,
  worker: UserPlus,
  daily: ShieldCheck,
  workerInspect: UserCheck,
  carrier: ShoppingCart,
};

const STEP_LABEL_KEY: Record<KittingGuideStepKey, string> = {
  equip: "kiosk.guide.stepEquip",
  jobOrder: "kiosk.guide.stepJobOrder",
  circuit: "production.subprocess.guide.stepCircuit",
  worker: "kiosk.guide.stepWorker",
  daily: "kiosk.guide.stepDaily",
  workerInspect: "kiosk.guide.stepWorkerInspect",
  carrier: "production.inputAssembly.guide.stepCarrier",
};

const STEP_HINT_KEY: Record<KittingGuideStepKey, string> = {
  equip: "production.subprocess.guide.hintEquip",
  jobOrder: "production.subprocess.guide.hintJobOrder",
  circuit: "production.subprocess.guide.hintCircuit",
  worker: "kiosk.guide.hintWorker",
  daily: "kiosk.guide.hintDaily",
  workerInspect: "kiosk.guide.hintWorkerInspect",
  carrier: "production.inputAssembly.guide.hintCarrier",
};

export default function KittingPrepGuideModal({
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
  onFocusCircuit,
  onFocusCarrier,
}: KittingPrepGuideModalProps) {
  const { t } = useTranslation();

  const openAction: Record<KittingGuideStepKey, () => void> = {
    equip: onOpenEquipSelect,
    jobOrder: onOpenJobOrder,
    circuit: onFocusCircuit,
    worker: onOpenWorker,
    daily: onOpenDailyInspect,
    workerInspect: onOpenWorkerInspect,
    carrier: onFocusCarrier,
  };

  const views: PrepGuideStepView<KittingGuideStepKey>[] = steps.map((s) => ({
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
      title={t("production.subprocess.guide.title")}
      subtitle={t("production.subprocess.guide.subtitle")}
      allReadyDesc={t("production.subprocess.guide.allReadyDesc")}
      steps={views}
      current={currentView}
      doneCount={doneCount}
      allReady={allReady}
      onClose={onClose}
      testIdPrefix="subkit-guide"
    />
  );
}
