"use client";

/**
 * @file inspection/result/components/InspectStationHeader.tsx
 * @description 통전·단자검사 상단 헤더 — 실적입력(가공) 키오스크 EquipHeader와 같은 형식
 *
 * 초보자 가이드:
 * - Row1: 검사기 / 작업자 / 준비 점검 4종 / 전체화면 (작업지시는 좌측 목록이 단일 출처라 헤더에 넣지 않는다)
 * - 점검 카드는 키오스크와 같은 공용 HeaderCheckItem을 쓴다(라벨 + 상태 + 입력/보기 버튼).
 * - 상태 구분은 왼쪽 굵은 세로 보더 + 문구 색 + 버튼 톤. 카드 배경에 파스텔을 깔지 않는다.
 * - 4개가 모두 완료돼야 우측 합격·불합격 버튼이 열린다(서버도 같은 규칙으로 차단).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import {
  AlertTriangle, CheckCircle, ChevronDown, Cpu,
  History, Maximize2, Minimize2, UserPlus, X,
} from "lucide-react";
import { HeaderCheckItem } from "@/components/inspect";
import WorkerSelectModal from "@/components/worker/WorkerSelectModal";
import type { Worker } from "@/components/worker/WorkerSelector";
import api from "@/services/api";
import type { InspectPrepState } from "../hooks/useInspectPrepStatus";
import type { JobOrderRow } from "../types";

export interface TesterEquip {
  equipCode: string;
  equipName: string;
}

interface InspectStationHeaderProps {
  testers: TesterEquip[];
  equipCode: string;
  onSelectEquip: (equipCode: string) => void;
  /** 좌측 목록에서 고른 작업지시 — 헤더에 표시하지는 않고 점검 활성 조건 판단에만 쓴다 */
  order: JobOrderRow | null;
  prep: InspectPrepState;
  onOpenDailyInspect: () => void;
  onOpenWorkerInspect: () => void;
  onOpenSampleCheck: () => void;
  onOpenSampleCheckHistory: () => void;
  isFullView: boolean;
  onToggleFullscreen: () => void;
}

export default function InspectStationHeader({
  testers,
  equipCode,
  onSelectEquip,
  order,
  prep,
  onOpenDailyInspect,
  onOpenWorkerInspect,
  onOpenSampleCheck,
  onOpenSampleCheckHistory,
  isFullView,
  onToggleFullscreen,
}: InspectStationHeaderProps) {
  const { t } = useTranslation();
  const [equipOpen, setEquipOpen] = useState(false);
  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const equipBoxRef = useRef<HTMLDivElement>(null);
  const equipBtnRef = useRef<HTMLButtonElement>(null);
  const equipMenuRef = useRef<HTMLDivElement>(null);
  /** 드롭다운 위치 — 헤더가 overflow-x-auto 라 absolute 메뉴가 잘린다. body 로 portal 하고 좌표를 직접 준다 */
  const [equipMenuPos, setEquipMenuPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    const handle = () => setIsFullscreen(Boolean(document.fullscreenElement));
    handle();
    document.addEventListener("fullscreenchange", handle);
    return () => document.removeEventListener("fullscreenchange", handle);
  }, []);

  /** 검사기 목록 바깥 클릭 시 닫기 — 메뉴는 body 로 portal 되므로 메뉴 자신도 안쪽으로 친다 */
  useEffect(() => {
    if (!equipOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (equipBoxRef.current?.contains(target)) return;
      if (equipMenuRef.current?.contains(target)) return;
      setEquipOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [equipOpen]);

  /** 버튼 위치를 따라다닌다 — 헤더 가로 스크롤/창 크기 변경에도 메뉴가 버튼에 붙어 있게 한다 */
  useEffect(() => {
    if (!equipOpen) {
      setEquipMenuPos(null);
      return;
    }
    const sync = () => {
      const rect = equipBtnRef.current?.getBoundingClientRect();
      if (rect) setEquipMenuPos({ left: rect.left, top: rect.bottom + 4 });
    };
    sync();
    window.addEventListener("resize", sync);
    // 헤더 가로 스크롤을 포함해 어느 조상이 스크롤되든 잡으려면 capture 가 필요하다
    window.addEventListener("scroll", sync, true);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [equipOpen]);

  const selectedTester = testers.find((e) => e.equipCode === equipCode) ?? null;
  const workers = prep.workers;

  /** 현재 작업자 배정 저장 — 실패 시 이전 목록으로 되돌린다(키오스크와 동일). */
  const persistWorkers = useCallback(async (next: Worker[]) => {
    if (!equipCode) return;
    const previous = workers;
    prep.setWorkers(next);
    try {
      await api.patch(
        `/equipment/equips/${encodeURIComponent(equipCode)}/workers`,
        { workerCodes: next.map((worker) => worker.id) },
        { suppressErrorModal: true },
      );
      void prep.refresh();
    } catch {
      prep.setWorkers(previous);
      toast.error(t("inspection.result.prep.workerAssignError"));
    }
  }, [equipCode, workers, prep, t]);

  const handleConfirmWorker = useCallback((worker: Worker) => {
    setWorkerModalOpen(false);
    if (workers.some((w) => w.id === worker.id)) return;
    void persistWorkers([...workers, worker]);
  }, [workers, persistWorkers]);

  const handleRemoveWorker = useCallback((workerId: string) => {
    void persistWorkers(workers.filter((worker) => worker.id !== workerId));
  }, [workers, persistWorkers]);

  const hasEquip = Boolean(equipCode);
  const hasOrder = Boolean(order);
  const hasWorker = workers.length > 0;

  const equipReason = t("inspection.result.prep.selectEquipFirst");
  const orderReason = t("inspection.result.prep.selectOrderFirst");
  const workerReason = t("inspection.result.prep.selectWorkerFirst");

  const sampleRequired = prep.sampleCheck?.required ?? false;
  const sampleDone = prep.sampleCheck?.done ?? false;
  const sampleDetail = prep.sampleCheck
    ? `${prep.sampleCheck.workDate} ${prep.sampleCheck.shiftCode}`
    : undefined;

  return (
    <>
      <div className="flex-shrink-0 rounded-lg border border-border bg-card">
        <div className="flex h-14 items-center gap-3 overflow-x-auto px-3">

          {/* 검사기 선택 */}
          <div ref={equipBoxRef} className="relative shrink-0">
            <button
              ref={equipBtnRef}
              type="button"
              data-testid="inspect-equip-open"
              onClick={() => setEquipOpen((v) => !v)}
              className={`flex h-11 w-52 items-center gap-2 rounded-lg border-2 px-3 text-left transition-colors ${
                selectedTester
                  ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                  : "border-dashed border-border hover:border-primary animate-pulse"
              }`}
            >
              <Cpu className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                {selectedTester ? (
                  <>
                    <div className="truncate text-sm font-extrabold text-black dark:text-white">{selectedTester.equipName}</div>
                    <div className="truncate text-[11px] text-black/60 dark:text-white/60">{selectedTester.equipCode}</div>
                  </>
                ) : (
                  <span className="text-sm font-semibold text-black/60 dark:text-white/60">
                    {t("inspection.result.selectEquip")}
                  </span>
                )}
              </div>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
            </button>
            {equipOpen && equipMenuPos && createPortal(
              <div
                ref={equipMenuRef}
                data-testid="inspect-equip-menu"
                className="fixed z-50 max-h-72 w-72 overflow-y-auto rounded-lg border border-border bg-background py-1 shadow-xl"
                style={{ left: equipMenuPos.left, top: equipMenuPos.top }}
              >
                {testers.length === 0 && (
                  <p className="px-3 py-2 text-xs text-text-muted">{t("common.noData")}</p>
                )}
                {testers.map((tester) => (
                  <button
                    key={tester.equipCode}
                    type="button"
                    onClick={() => { onSelectEquip(tester.equipCode); setEquipOpen(false); }}
                    className={`flex w-full flex-col items-start px-3 py-2 text-left transition-colors hover:bg-surface ${
                      tester.equipCode === equipCode ? "border-l-4 border-l-primary" : "border-l-4 border-l-transparent"
                    }`}
                  >
                    <span className="text-sm font-semibold text-text">{tester.equipName}</span>
                    <span className="font-mono text-[11px] text-text-muted">{tester.equipCode}</span>
                  </button>
                ))}
              </div>,
              document.body,
            )}
          </div>

          {/* 작업자 */}
          <div className={`flex h-11 shrink-0 items-center gap-1.5 overflow-hidden rounded-lg border border-border bg-card pl-2 pr-2 ${
            hasWorker
              ? "border-l-4 border-l-green-600 dark:border-l-green-400"
              : hasEquip
                ? "border-l-4 border-l-red-500 dark:border-l-red-400"
                : "border-l-4 border-l-border"
          }`}>
            <UserPlus className="h-4 w-4 shrink-0 text-primary" />
            {workers.map((worker) => (
              <span
                key={worker.id}
                className="inline-flex items-center gap-1 rounded-full border border-green-600 px-2 py-0.5 text-xs font-bold text-green-700 dark:border-green-400 dark:text-green-400"
              >
                <CheckCircle className="h-3 w-3" />
                {worker.workerName}
                <button type="button" onClick={() => handleRemoveWorker(worker.id)} className="ml-0.5 transition-colors hover:text-red-500">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              type="button"
              data-testid="inspect-worker-open"
              onClick={() => setWorkerModalOpen(true)}
              disabled={!hasEquip}
              title={hasEquip ? t("inspection.result.prep.addWorker") : equipReason}
              className={`inline-flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-surface disabled:text-black/60 dark:disabled:text-white/60 ${
                hasEquip && !hasWorker ? "animate-pulse" : ""
              }`}
            >
              <UserPlus className="h-3 w-3" />
              {t("inspection.result.prep.addWorker")}
            </button>
            {!hasWorker && hasEquip && (
              <span className="flex items-center gap-1 whitespace-nowrap text-xs font-bold text-red-600 dark:text-red-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {t("inspection.result.prep.workerRequired")}
              </span>
            )}
          </div>

          {/* 준비 점검 4종 — 키오스크와 같은 카드 (작업지시는 좌측 목록이 단일 출처라 헤더에 두지 않는다) */}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <HeaderCheckItem
              label={t("inspection.result.prep.dailyInspect")}
              done={hasEquip && (!prep.gate.dailyRequired || prep.gate.dailyDone)}
              doneDetail={prep.gate.dailyInspectedAt ?? undefined}
              notDoneDetail={prep.gate.dailyResult ?? undefined}
              disabled={!hasEquip}
              disabledReason={equipReason}
              onInput={onOpenDailyInspect}
              testId="inspect-daily-open"
              wide
            />
            <HeaderCheckItem
              label={t("inspection.result.prep.workerInspect")}
              done={hasEquip && (!prep.gate.workerRequired || prep.gate.workerDone)}
              doneDetail={prep.gate.workerInspectedAt ?? undefined}
              notDoneDetail={prep.gate.workerResult ?? undefined}
              disabled={!hasEquip || !hasOrder || !hasWorker}
              disabledReason={!hasEquip ? equipReason : !hasOrder ? orderReason : workerReason}
              onInput={onOpenWorkerInspect}
              testId="inspect-worker-inspect-open"
              wide
            />
            <div className="flex items-center gap-1">
              <HeaderCheckItem
                label={t("inspection.result.prep.sampleCheck")}
                done={hasEquip && (!sampleRequired || sampleDone)}
                doneDetail={sampleDetail}
                notDoneDetail={prep.sampleCheck?.overallResult ?? undefined}
                notTarget={hasEquip && hasOrder && !sampleRequired}
                notTargetDetail={t("inspection.result.sampleCheck.noCandidates")}
                disabled={!hasEquip || !hasOrder}
                disabledReason={!hasEquip ? equipReason : orderReason}
                onInput={onOpenSampleCheck}
                testId="inspect-sample-check-open"
                wide
              />
              <button
                type="button"
                data-testid="inspect-sample-check-history"
                onClick={onOpenSampleCheckHistory}
                disabled={!hasOrder}
                title={hasOrder ? t("inspection.result.prep.sampleCheckHistory") : orderReason}
                className="inline-flex h-11 w-9 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <History className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 전체화면 */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            title={isFullView || isFullscreen ? t("inspection.result.exitFullscreen") : t("inspection.result.fullscreen")}
            aria-label={isFullView || isFullscreen ? t("inspection.result.exitFullscreen") : t("inspection.result.fullscreen")}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-text-muted transition-colors hover:border-primary hover:text-primary"
          >
            {isFullView || isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>

        {/* 준비 미완료 사유 */}
        {!prep.ready && prep.blockReason && (
          <div className="flex items-center gap-2 border-t border-border px-3 py-1.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
            <span className="truncate text-xs font-bold text-red-600 dark:text-red-400" title={prep.blockReason}>
              {prep.blockReason}
            </span>
          </div>
        )}
      </div>

      <WorkerSelectModal
        isOpen={workerModalOpen}
        onClose={() => setWorkerModalOpen(false)}
        onConfirm={handleConfirmWorker}
      />
    </>
  );
}
