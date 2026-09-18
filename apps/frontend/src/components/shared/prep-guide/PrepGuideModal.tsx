"use client";

/**
 * @file components/shared/prep-guide/PrepGuideModal.tsx
 * @description 준비 안내 모달(공용) — 화면 진입 시 중앙 글래스 패널로 떠서 단계를 한 번에 하나씩 유도한다.
 *
 * 초보자 가이드:
 * 1. 단계 판정은 화면 쪽(prepGuide.ts assignPrepGuideStatuses)이 하고, 이 컴포넌트는 그리기만 한다.
 * 2. 좌측 스텝퍼 + 우측 현재 단계 패널. 현재 단계는 content(직접 고르기)나 action(공용 모달 열기)으로 실행한다.
 *    안내가 별도 입력 경로를 만들면 헤더와 두 갈래가 되므로, action은 헤더가 쓰는 같은 핸들러를 받는다.
 * 3. z-40 — 공용 Modal(z-50)이 이 패널 위에 뜨도록 한 단계 아래에 둔다.
 * 4. document ESC 리스너를 달지 않는다 — 위에 뜬 공용 모달의 ESC가 document까지 올라와 안내까지 같이 닫힌다(2026-09-18 확인).
 *    닫기는 X·나중에 하기·배경 클릭.
 * 5. 애니메이션은 globals.css의 guide-* keyframes. CTA는 transform으로 움직이지 않는다(Playwright/시나리오 러너 안정성).
 * 6. 배경은 유리(반투명+blur)만 쓰고, 단계 상태는 테두리·텍스트 색으로 구분한다. 파스텔 배경 카드는 쓰지 않는다.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Lock, Sparkles, X } from "lucide-react";
import type { PrepGuideStatus, PrepGuideStepView } from "./prepGuide";

interface PrepGuideModalProps {
  open: boolean;
  title: string;
  subtitle: string;
  /** 전부 끝났을 때 보조 문구 */
  allReadyDesc: string;
  steps: PrepGuideStepView[];
  current: PrepGuideStepView | null;
  doneCount: number;
  allReady: boolean;
  onClose: () => void;
  /** data-testid 접두어 (기본 prep-guide) */
  testIdPrefix?: string;
}

export default function PrepGuideModal({
  open,
  title,
  subtitle,
  allReadyDesc,
  steps,
  current,
  doneCount,
  allReady,
  onClose,
  testIdPrefix = "prep-guide",
}: PrepGuideModalProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!open || !mounted) return null;

  const total = steps.length;
  const progressPct = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  const CurrentIcon = current?.icon ?? Sparkles;
  const currentIndex = current ? steps.findIndex((s) => s.key === current.key) + 1 : 0;

  const statusLabel = (status: PrepGuideStatus) => {
    switch (status) {
      case "done": return t("prepGuide.doneLabel");
      case "current": return t("prepGuide.currentLabel");
      case "notTarget": return t("prepGuide.notTarget");
      default: return t("prepGuide.waitLabel");
    }
  };

  const toneOf = (status: PrepGuideStatus) =>
    status === "done" ? "border-green-600 text-green-700 dark:border-green-400 dark:text-green-400"
    : status === "current" ? "border-primary text-primary"
    : status === "notTarget" ? "border-border text-text-muted"
    : "border-border text-text-muted/60";

  const textToneOf = (status: PrepGuideStatus) =>
    toneOf(status).split(" ").filter((c) => c.startsWith("text-") || c.startsWith("dark:text-")).join(" ");

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      data-testid={testIdPrefix}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${testIdPrefix}-title`}
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
            <h2 id={`${testIdPrefix}-title`} className="flex items-center gap-2 text-lg font-extrabold text-text">
              <Sparkles className="h-5 w-5 text-primary" />
              {title}
            </h2>
            <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="rounded-full border border-primary/40 px-3 py-1 text-xs font-bold tabular-nums text-primary">
              {t("prepGuide.progress", { done: doneCount, total })}
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
              const Icon = step.icon;
              const isLast = idx === steps.length - 1;
              const tone = toneOf(step.status);
              return (
                <li
                  key={step.key}
                  data-testid={`${testIdPrefix}-step-${step.key}`}
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
                        step.status === "current" || step.status === "done" ? "text-text" : "text-text-muted"
                      }`}>
                        <span className="mr-1.5 tabular-nums opacity-60">{idx + 1}.</span>
                        {step.label}
                      </span>
                      <span className={`shrink-0 text-[11px] font-bold ${textToneOf(step.status)}`}>
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
            key={current?.key ?? "ready"}
            className="col-span-7 flex min-h-[300px] flex-col rounded-xl border border-white/60 bg-white/50 p-5 dark:border-white/10 dark:bg-white/5 guide-panel"
          >
            {allReady ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center" data-testid={`${testIdPrefix}-ready`}>
                <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-green-600 text-green-600 dark:border-green-400 dark:text-green-400 guide-ring-success">
                  <CheckCircle2 className="h-10 w-10 guide-pop" />
                </div>
                <p className="text-xl font-extrabold text-text">{t("prepGuide.allReady")}</p>
                <p className="mt-1 text-sm text-text-muted">{allReadyDesc}</p>
              </div>
            ) : current ? (
              <>
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-primary text-primary guide-ring">
                    <CurrentIcon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
                      {t("prepGuide.currentLabel")} · {currentIndex}/{total}
                    </p>
                    <p className="truncate text-lg font-extrabold text-text">{current.label}</p>
                  </div>
                </div>
                <p className="mb-4 text-sm text-text-muted">{current.hint}</p>

                {current.content}

                {current.action && (
                  <div className="mt-auto pt-2">
                    <button
                      type="button"
                      data-testid={`${testIdPrefix}-action`}
                      onClick={current.action}
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-extrabold text-white shadow-lg shadow-primary/30 transition-colors hover:bg-primary/90 guide-cta"
                    >
                      <CurrentIcon className="h-5 w-5" />
                      {current.actionLabel ?? t("prepGuide.actionOpen", { step: current.label })}
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
            data-testid={`${testIdPrefix}-later`}
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-muted transition-colors hover:border-primary hover:text-primary"
          >
            {t("prepGuide.later")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
