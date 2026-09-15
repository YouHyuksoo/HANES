"use client";

/**
 * @file inspection/result/components/InspectPrepCheckBar.tsx
 * @description 통전·단자검사 준비 4단계 체크바 — 실적입력(가공) PrepCheckBar와 같은 흐름
 *
 * 초보자 가이드:
 * ① 설비일상점검  (검사기 기준, 조업일 1회)
 * ② 작업자설비점검 (작업지시 기준, 작업자 선택 후 가능)
 * ③ 양불마스터 대조 (작업지시 x 검사기 x 조업일 x 교대 1회, [양/불체크 시작])
 * ④ 소모품 장착   (좌측 ConsumablePanel 보고)
 * 4개가 모두 완료돼야 합격·불합격 버튼이 열린다. 서버도 같은 규칙으로 등록을 막는다.
 * 배경 파스텔은 쓰지 않는다. 완료/미완료는 테두리·텍스트로 구분한다.
 */
import { useTranslation } from "react-i18next";
import { CheckCircle2, History, ScanBarcode, XCircle } from "lucide-react";
import type { InspectPrepState } from "../hooks/useInspectPrepStatus";

interface CheckItemProps {
  step: number;
  label: string;
  done: boolean;
  disabled?: boolean;
  disabledReason?: string;
  detail?: string | null;
  onClick?: () => void;
  testId?: string;
}

function CheckItem({ step, label, done, disabled, disabledReason, detail, onClick, testId }: CheckItemProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled || !onClick}
      title={disabled && disabledReason ? disabledReason : (detail ?? label)}
      className={[
        "flex items-center gap-2 rounded border px-3 py-1.5 text-xs font-semibold transition-colors",
        done
          ? "border-green-600 text-green-700 dark:border-green-400 dark:text-green-400 cursor-default"
          : disabled
            ? "border-border text-text-muted opacity-60 cursor-not-allowed"
            : "border-orange-500 text-orange-700 dark:border-orange-400 dark:text-orange-300 hover:border-primary hover:text-primary",
      ].join(" ")}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current text-[10px]">
        {step}
      </span>
      {done ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
      <span className="whitespace-nowrap">{label}</span>
      {detail && <span className="text-[11px] font-normal text-text-muted">{detail}</span>}
    </button>
  );
}

interface InspectPrepCheckBarProps {
  prep: InspectPrepState;
  hasEquip: boolean;
  hasOrder: boolean;
  onOpenDailyInspect: () => void;
  onOpenWorkerInspect: () => void;
  onOpenSampleCheck: () => void;
  onOpenSampleCheckHistory: () => void;
}

export default function InspectPrepCheckBar({
  prep,
  hasEquip,
  hasOrder,
  onOpenDailyInspect,
  onOpenWorkerInspect,
  onOpenSampleCheck,
  onOpenSampleCheckHistory,
}: InspectPrepCheckBarProps) {
  const { t } = useTranslation();
  const hasWorker = prep.workers.length > 0;
  const sampleRequired = prep.sampleCheck?.required ?? false;
  const sampleDone = prep.sampleCheck?.done ?? false;

  const equipReason = t("inspection.result.prep.selectEquipFirst");
  const orderReason = t("inspection.result.prep.selectOrderFirst");
  const workerReason = t("inspection.result.prep.selectWorkerFirst");

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <CheckItem
        step={1}
        label={t("inspection.result.prep.dailyInspect")}
        done={hasEquip && (!prep.gate.dailyRequired || prep.gate.dailyDone)}
        disabled={!hasEquip}
        disabledReason={equipReason}
        detail={prep.gate.dailyResult && !prep.gate.dailyDone ? prep.gate.dailyResult : null}
        onClick={onOpenDailyInspect}
        testId="inspect-daily-open"
      />
      <CheckItem
        step={2}
        label={t("inspection.result.prep.workerInspect")}
        done={hasEquip && (!prep.gate.workerRequired || prep.gate.workerDone)}
        disabled={!hasEquip || !hasOrder || !hasWorker}
        disabledReason={!hasEquip ? equipReason : !hasOrder ? orderReason : workerReason}
        detail={prep.gate.workerResult && !prep.gate.workerDone ? prep.gate.workerResult : null}
        onClick={onOpenWorkerInspect}
        testId="inspect-worker-inspect-open"
      />
      <CheckItem
        step={3}
        label={t("inspection.result.prep.sampleCheck")}
        done={hasEquip && (!sampleRequired || sampleDone)}
        disabled={!hasEquip || !hasOrder}
        disabledReason={!hasEquip ? equipReason : orderReason}
        detail={prep.sampleCheck ? `${prep.sampleCheck.workDate} ${prep.sampleCheck.shiftCode}` : null}
      />
      <button
        type="button"
        data-testid="inspect-sample-check-open"
        onClick={onOpenSampleCheck}
        disabled={!hasEquip || !hasOrder}
        title={!hasEquip ? equipReason : !hasOrder ? orderReason : t("inspection.result.prep.sampleCheckStart")}
        className="inline-flex items-center gap-1 rounded bg-primary px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-surface disabled:text-text-muted"
      >
        <ScanBarcode className="h-3.5 w-3.5" />
        {t("inspection.result.prep.sampleCheckStart")}
      </button>
      <button
        type="button"
        data-testid="inspect-sample-check-history"
        onClick={onOpenSampleCheckHistory}
        disabled={!hasOrder}
        title={!hasOrder ? orderReason : t("inspection.result.prep.sampleCheckHistory")}
        className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        <History className="h-3.5 w-3.5" />
        {t("inspection.result.prep.sampleCheckHistory")}
      </button>
      <CheckItem
        step={4}
        label={t("inspection.result.prep.consumable")}
        done={prep.consumablesReady}
        detail={prep.consumablesReady ? null : String(prep.unmountedConsumCount)}
      />
      {!prep.ready && prep.blockReason && (
        <span className="ml-auto truncate text-xs font-semibold text-red-600 dark:text-red-400" title={prep.blockReason}>
          {prep.blockReason}
        </span>
      )}
    </div>
  );
}
