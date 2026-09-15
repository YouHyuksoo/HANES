"use client";

/**
 * @file inspection/result/components/InspectStationBar.tsx
 * @description 검사기(TESTER) 선택 + 작업자 선택 바
 *
 * 초보자 가이드:
 * 1. 실적입력(가공) 키오스크와 같은 방식이다. 공용 WorkerSelectModal + 설비 현재작업자 배정 API를 쓴다.
 * 2. 작업자 0명이면 왼쪽 굵은 빨강 보더로 알리고 검사 판정 버튼이 비활성된다(서버도 같은 규칙으로 차단).
 * 3. 배경 파스텔은 쓰지 않는다. 테두리·텍스트로 상태를 구분한다.
 */
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { AlertTriangle, CheckCircle, Cpu, UserPlus, X } from "lucide-react";
import { Select } from "@/components/ui";
import WorkerSelectModal from "@/components/worker/WorkerSelectModal";
import type { Worker } from "@/components/worker/WorkerSelector";
import api from "@/services/api";

export interface TesterEquip {
  equipCode: string;
  equipName: string;
}

interface InspectStationBarProps {
  testers: TesterEquip[];
  equipCode: string;
  onSelectEquip: (equipCode: string) => void;
  workers: Worker[];
  onWorkersChange: (workers: Worker[]) => void;
}

export default function InspectStationBar({
  testers,
  equipCode,
  onSelectEquip,
  workers,
  onWorkersChange,
}: InspectStationBarProps) {
  const { t } = useTranslation();
  const [workerModalOpen, setWorkerModalOpen] = useState(false);

  /** 현재 작업자 배정 저장 — 실패 시 이전 목록으로 되돌린다(키오스크와 동일). */
  const persistWorkers = useCallback(async (next: Worker[]) => {
    if (!equipCode) return;
    const previous = workers;
    onWorkersChange(next);
    try {
      await api.patch(
        `/equipment/equips/${encodeURIComponent(equipCode)}/workers`,
        { workerCodes: next.map((worker) => worker.id) },
        { suppressErrorModal: true },
      );
    } catch {
      onWorkersChange(previous);
      toast.error(t("inspection.result.prep.workerAssignError"));
    }
  }, [equipCode, workers, onWorkersChange, t]);

  const handleConfirmWorker = useCallback((worker: Worker) => {
    setWorkerModalOpen(false);
    if (workers.some((w) => w.id === worker.id)) return;
    void persistWorkers([...workers, worker]);
  }, [workers, persistWorkers]);

  const handleRemoveWorker = useCallback((workerId: string) => {
    void persistWorkers(workers.filter((worker) => worker.id !== workerId));
  }, [workers, persistWorkers]);

  const workerBorder = workers.length > 0
    ? "border-l-4 border-l-green-600 dark:border-l-green-400"
    : equipCode
      ? "border-l-4 border-l-red-500 dark:border-l-red-400"
      : "border-l-4 border-l-border";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Cpu className="w-4 h-4 text-primary shrink-0" />
        <Select
          value={equipCode}
          onChange={onSelectEquip}
          placeholder={t("inspection.result.selectEquip")}
          options={testers.map((e) => ({ value: e.equipCode, label: `${e.equipName} (${e.equipCode})` }))}
          className="flex-1"
        />
      </div>

      <div className={`flex min-h-[2.25rem] flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card pl-2 pr-2 py-1 ${workerBorder}`}>
        <UserPlus className="h-4 w-4 shrink-0 text-primary" />
        {workers.map((worker) => (
          <span
            key={worker.id}
            className="inline-flex items-center gap-1 rounded-full border border-green-600 px-2 py-0.5 text-xs font-bold text-green-700 dark:border-green-400 dark:text-green-400"
          >
            <CheckCircle className="h-3 w-3" />
            {worker.workerName}
            <button
              type="button"
              onClick={() => handleRemoveWorker(worker.id)}
              className="ml-0.5 transition-colors hover:text-red-500"
              title={t("common.delete")}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <button
          type="button"
          data-testid="inspect-worker-open"
          onClick={() => setWorkerModalOpen(true)}
          disabled={!equipCode}
          title={equipCode ? t("inspection.result.prep.addWorker") : t("inspection.result.prep.selectEquipFirst")}
          className="inline-flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-surface disabled:text-text-muted"
        >
          <UserPlus className="h-3 w-3" />
          {t("inspection.result.prep.addWorker")}
        </button>
        {workers.length === 0 && equipCode && (
          <span className="flex items-center gap-1 whitespace-nowrap text-xs font-bold text-red-600 dark:text-red-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {t("inspection.result.prep.workerRequired")}
          </span>
        )}
      </div>

      <WorkerSelectModal
        isOpen={workerModalOpen}
        onClose={() => setWorkerModalOpen(false)}
        onConfirm={handleConfirmWorker}
      />
    </div>
  );
}
