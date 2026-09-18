"use client";

/**
 * @file production/input-kiosk/components/KioskPrepGuideModal.tsx
 * @description 실적입력(가공) 키오스크 준비 안내 — 공용 PrepGuideModal에 이 화면의 단계 라벨·힌트·실행을 채운다.
 *
 * 초보자 가이드:
 * 1. 단계 판정은 utils/kioskPrepGuideSteps.ts, 그리기는 components/shared/prep-guide/PrepGuideModal.
 *    이 파일은 둘을 잇는 매핑만 한다(라벨 i18n, 아이콘, 실행 버튼).
 * 2. 모든 단계의 실행은 헤더·좌측 패널이 쓰는 같은 모달(설비 선택·작업지시·작업자·점검·스캔)을 연다.
 *    안내가 별도 입력 경로를 만들면 두 갈래가 되므로 부모의 같은 핸들러를 받는다.
 */
import { useTranslation } from "react-i18next";
import {
  CheckCircle2, ClipboardList, Cpu, PackageSearch, ScanBarcode, ShieldCheck, UserCheck, UserPlus,
  type LucideIcon,
} from "lucide-react";
import { PrepGuideModal, type PrepGuideStepView } from "@/components/shared/prep-guide";
import type { KioskGuideStep, KioskGuideStepKey } from "../utils/kioskPrepGuideSteps";

interface KioskPrepGuideModalProps {
  open: boolean;
  steps: KioskGuideStep[];
  current: KioskGuideStep | null;
  doneCount: number;
  allReady: boolean;
  onClose: () => void;
  workerNames: string[];
  onOpenEquipSelect: () => void;
  onOpenJobOrder: () => void;
  onOpenWorker: () => void;
  onOpenDailyInspect: () => void;
  onOpenWorkerInspect: () => void;
  onOpenMaterialScan: () => void;
  onOpenConsumableScan: () => void;
}

const STEP_ICON: Record<KioskGuideStepKey, LucideIcon> = {
  equip: Cpu,
  jobOrder: ClipboardList,
  worker: UserPlus,
  daily: ShieldCheck,
  workerInspect: UserCheck,
  materialScan: ScanBarcode,
  consumableScan: PackageSearch,
};

const STEP_LABEL_KEY: Record<KioskGuideStepKey, string> = {
  equip: "kiosk.guide.stepEquip",
  jobOrder: "kiosk.guide.stepJobOrder",
  worker: "kiosk.guide.stepWorker",
  daily: "kiosk.guide.stepDaily",
  workerInspect: "kiosk.guide.stepWorkerInspect",
  materialScan: "kiosk.guide.stepMaterialScan",
  consumableScan: "kiosk.guide.stepConsumableScan",
};

const STEP_HINT_KEY: Record<KioskGuideStepKey, string> = {
  equip: "kiosk.guide.hintEquip",
  jobOrder: "kiosk.guide.hintJobOrder",
  worker: "kiosk.guide.hintWorker",
  daily: "kiosk.guide.hintDaily",
  workerInspect: "kiosk.guide.hintWorkerInspect",
  materialScan: "kiosk.guide.hintMaterialScan",
  consumableScan: "kiosk.guide.hintConsumableScan",
};

export default function KioskPrepGuideModal({
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
  onOpenMaterialScan,
  onOpenConsumableScan,
}: KioskPrepGuideModalProps) {
  const { t } = useTranslation();

  const openAction: Record<KioskGuideStepKey, () => void> = {
    equip: onOpenEquipSelect,
    jobOrder: onOpenJobOrder,
    worker: onOpenWorker,
    daily: onOpenDailyInspect,
    workerInspect: onOpenWorkerInspect,
    materialScan: onOpenMaterialScan,
    consumableScan: onOpenConsumableScan,
  };

  const views: PrepGuideStepView<KioskGuideStepKey>[] = steps.map((s) => ({
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
      title={t("kiosk.guide.title")}
      subtitle={t("kiosk.guide.subtitle")}
      allReadyDesc={t("kiosk.guide.allReadyDesc")}
      steps={views}
      current={currentView}
      doneCount={doneCount}
      allReady={allReady}
      onClose={onClose}
      testIdPrefix="kiosk-guide"
    />
  );
}
