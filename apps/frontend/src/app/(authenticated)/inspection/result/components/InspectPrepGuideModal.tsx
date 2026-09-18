"use client";

/**
 * @file inspection/result/components/InspectPrepGuideModal.tsx
 * @description 통전·단자검사 준비 안내 모달 — 화면 진입 시 중앙에 글래스 패널로 떠서
 *              검사기 → 작업자 → 작업지시 → 설비일상점검 → 작업자설비점검 → 양불마스터 대조를 한 단계씩 유도한다.
 *
 * 초보자 가이드:
 * 1. 단계 완료 판정은 useInspectPrepGuide/prepGuideSteps가 하고, 이 컴포넌트는 그리기만 한다.
 * 2. 검사기·작업지시는 이 패널 안에서 바로 고른다. 나머지 단계는 헤더가 쓰는 같은 모달(작업자 선택·점검·대조)을 연다.
 *    안내가 별도 입력 경로를 만들면 헤더와 두 갈래가 되므로, 실행 버튼은 부모의 같은 핸들러를 호출한다.
 * 3. z-40 — 공용 Modal(z-50)이 이 패널 위에 뜨도록 한 단계 아래에 둔다.
 * 4. 애니메이션은 globals.css의 guide-* keyframes(패널 상승, 현재 단계 링 펄스, 완료 체크 팝, 진행바)를 쓴다.
 * 5. 배경은 유리(반투명+blur)만 쓰고, 단계 상태는 테두리·텍스트 색으로 구분한다. 파스텔 배경 카드는 쓰지 않는다.
 */
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2, ClipboardCheck, ClipboardList, Cpu, Lock,
  ScanSearch, Search, Sparkles, UserCheck, UserPlus, X,
} from "lucide-react";
import { Input } from "@/components/ui";
import type { Worker } from "@/components/worker/WorkerSelector";
import type { JobOrderRow } from "../types";
import type { PrepGuideStep, PrepGuideStepKey } from "../hooks/prepGuideSteps";
import type { TesterEquip } from "./InspectStationHeader";

interface InspectPrepGuideModalProps {
  open: boolean;
  steps: PrepGuideStep[];
  current: PrepGuideStep | null;
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

const STEP_ICON: Record<PrepGuideStepKey, ComponentType<{ className?: string }>> = {
  equip: Cpu,
  worker: UserPlus,
  order: ClipboardList,
  daily: ClipboardCheck,
  workerInspect: UserCheck,
  sampleCheck: ScanSearch,
};

const STEP_LABEL_KEY: Record<PrepGuideStepKey, string> = {
  equip: "inspection.result.guide.stepEquip",
  worker: "inspection.result.guide.stepWorker",
  order: "inspection.result.guide.stepOrder",
  daily: "inspection.result.guide.stepDaily",
  workerInspect: "inspection.result.guide.stepWorkerInspect",
  sampleCheck: "inspection.result.guide.stepSampleCheck",
};

const STEP_HINT_KEY: Record<PrepGuideStepKey, string> = {
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  /**
   * ESC 닫기는 두지 않는다 — 위에 뜬 공용 모달(작업자 선택·점검·대조)이 받는 ESC가 document까지 올라와
   * 안내까지 같이 닫혔다(2026-09-18 검증에서 확인). 닫기는 X·나중에 하기·배경 클릭으로 한다.
   */

  const filteredOrders = useMemo(() => {
    const q = orderQuery.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      o.orderNo.toLowerCase().includes(q)
      || (o.itemName ?? "").toLowerCase().includes(q)
      || o.itemCode.toLowerCase().includes(q));
  }, [orders, orderQuery]);

  if (!open || !mounted) return null;

  const total = steps.length;
  const progressPct = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  const currentKey = current?.key ?? null;
  const CurrentIcon = currentKey ? STEP_ICON[currentKey] : Sparkles;

  const openAction: Partial<Record<PrepGuideStepKey, () => void>> = {
    worker: onOpenWorkerSelect,
    daily: onOpenDailyInspect,
    workerInspect: onOpenWorkerInspect,
    sampleCheck: onOpenSampleCheck,
  };

  const statusLabel = (status: PrepGuideStep["status"]) => {
    switch (status) {
      case "done": return t("inspection.result.guide.doneLabel");
      case "current": return t("inspection.result.guide.currentLabel");
      case "notTarget": return t("inspection.result.guide.notTarget");
      default: return t("inspection.result.guide.waitLabel");
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      data-testid="inspect-prep-guide"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspect-prep-guide-title"
    >
      {/* 배경 — 뒤 화면을 흐리게만 하고 가리지 않는다 */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 글래스 패널 */}
      <div
        className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/50 bg-white/70 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/65 guide-rise"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 유리 반사 하이라이트 */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/60 to-transparent dark:from-white/10" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl guide-orb" aria-hidden="true" />

        {/* 진행바 */}
        <div className="relative h-1.5 w-full bg-black/10 dark:bg-white/10">
          <div
            className="h-full bg-primary transition-[width] duration-700 ease-out guide-progress"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* 헤더 */}
        <div className="relative flex items-start justify-between gap-3 px-6 pt-5">
          <div className="min-w-0">
            <h2 id="inspect-prep-guide-title" className="flex items-center gap-2 text-lg font-extrabold text-text">
              <Sparkles className="h-5 w-5 text-primary" />
              {t("inspection.result.guide.title")}
            </h2>
            <p className="mt-0.5 text-sm text-text-muted">{t("inspection.result.guide.subtitle")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="rounded-full border border-primary/40 px-3 py-1 text-xs font-bold tabular-nums text-primary">
              {t("inspection.result.guide.progress", { done: doneCount, total })}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-black/5 hover:text-text dark:hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 본문 — 좌: 단계 목록 / 우: 현재 단계 실행 */}
        <div className="relative grid grid-cols-12 gap-5 px-6 pb-5 pt-4">
          <ol className="col-span-5 flex flex-col">
            {steps.map((step, idx) => {
              const Icon = STEP_ICON[step.key];
              const isLast = idx === steps.length - 1;
              const tone =
                step.status === "done" ? "border-green-600 text-green-700 dark:border-green-400 dark:text-green-400"
                : step.status === "current" ? "border-primary text-primary"
                : step.status === "notTarget" ? "border-border text-text-muted"
                : "border-border text-text-muted/60";
              return (
                <li
                  key={step.key}
                  data-testid={`inspect-guide-step-${step.key}`}
                  data-status={step.status}
                  className="relative flex gap-3 guide-step"
                  style={{ animationDelay: `${idx * 70}ms` }}
                >
                  {/* 연결선 + 원형 마커 */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-white/60 dark:bg-slate-900/60 ${tone} ${
                        step.status === "current" ? "guide-ring" : ""
                      }`}
                    >
                      {step.status === "done" ? (
                        <CheckCircle2 className="h-5 w-5 guide-pop" />
                      ) : step.status === "locked" ? (
                        <Lock className="h-4 w-4" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    {!isLast && (
                      <div className={`w-0.5 flex-1 min-h-[14px] ${
                        step.status === "done" || step.status === "notTarget" ? "bg-green-600/60 dark:bg-green-400/60" : "bg-border"
                      }`} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm font-bold ${
                        step.status === "current" ? "text-text" : step.status === "done" ? "text-text" : "text-text-muted"
                      }`}>
                        <span className="mr-1.5 tabular-nums opacity-60">{idx + 1}.</span>
                        {t(STEP_LABEL_KEY[step.key])}
                      </span>
                      <span className={`shrink-0 text-[11px] font-bold ${tone.split(" ").filter((c) => c.startsWith("text-") || c.startsWith("dark:text-")).join(" ")}`}>
                        {statusLabel(step.status)}
                      </span>
                    </div>
                    {step.detail && (step.status === "done" || step.status === "notTarget") && (
                      <p className="truncate text-[11px] text-text-muted" title={step.detail}>{step.detail}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {/* 현재 단계 패널 */}
          <div
            key={currentKey ?? "ready"}
            className="col-span-7 flex min-h-[300px] flex-col rounded-xl border border-white/60 bg-white/50 p-5 dark:border-white/10 dark:bg-white/5 guide-panel"
          >
            {allReady ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center" data-testid="inspect-guide-ready">
                <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-green-600 text-green-600 dark:border-green-400 dark:text-green-400 guide-ring-success">
                  <CheckCircle2 className="h-10 w-10 guide-pop" />
                </div>
                <p className="text-xl font-extrabold text-text">{t("inspection.result.guide.allReady")}</p>
                <p className="mt-1 text-sm text-text-muted">{t("inspection.result.guide.allReadyDesc")}</p>
              </div>
            ) : current ? (
              <>
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-primary text-primary guide-ring">
                    <CurrentIcon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
                      {t("inspection.result.guide.currentLabel")} · {steps.findIndex((s) => s.key === current.key) + 1}/{total}
                    </p>
                    <p className="truncate text-lg font-extrabold text-text">{t(STEP_LABEL_KEY[current.key])}</p>
                  </div>
                </div>
                <p className="mb-4 text-sm text-text-muted">{t(STEP_HINT_KEY[current.key])}</p>

                {current.key === "equip" && (
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
                )}

                {current.key === "order" && (
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
                )}

                {current.key === "worker" && workers.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {workers.map((w) => (
                      <span key={w.id} className="inline-flex items-center gap-1 rounded-full border border-green-600 px-2 py-0.5 text-xs font-bold text-green-700 dark:border-green-400 dark:text-green-400">
                        <CheckCircle2 className="h-3 w-3" />
                        {w.workerName}
                      </span>
                    ))}
                  </div>
                )}

                {openAction[current.key] && (
                  <div className="mt-auto pt-2">
                    <button
                      type="button"
                      data-testid="inspect-guide-action"
                      onClick={openAction[current.key]}
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-extrabold text-white shadow-lg shadow-primary/30 transition-transform hover:bg-primary/90 active:scale-[0.98] guide-cta"
                    >
                      <CurrentIcon className="h-5 w-5" />
                      {t("inspection.result.guide.actionOpen", { step: t(STEP_LABEL_KEY[current.key]) })}
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* 푸터 */}
        <div className="relative flex items-center justify-end border-t border-white/40 px-6 py-3 dark:border-white/10">
          <button
            type="button"
            data-testid="inspect-guide-later"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-muted transition-colors hover:border-primary hover:text-primary"
          >
            {t("inspection.result.guide.later")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
