"use client";

/**
 * @file src/app/(authenticated)/dashboard/components/InspectRails.tsx
 * @description 오늘 점검 레일 — 일상/정기/예방보전 3줄. 각 줄은 설비 1대 = 칸 1개인 세그먼트 레일로,
 *              합격(초록)/불합격(빨강)/조건부(노랑)/미실시(회색) 을 한눈에 보여준다. 줄 클릭 시 캘린더로 이동.
 */
import Link from "next/link";
import { useTranslation } from "react-i18next";
import type { DashboardSummary, InspectSummary } from "./types";
import { emptyInspect } from "./types";

const RESULT_TONE: Record<string, string> = {
  PASS: "bg-success",
  COMPLETED: "bg-success",
  FAIL: "bg-error",
  CONDITIONAL: "bg-warning",
};

const RAILS: Array<{ kind: "daily" | "periodic" | "pm"; href: string }> = [
  { kind: "daily", href: "/equipment/inspect-calendar" },
  { kind: "periodic", href: "/equipment/periodic-inspect-calendar" },
  { kind: "pm", href: "/equipment/pm-calendar" },
];

function Rail({ kind, href, s, delay }: { kind: string; href: string; s: InspectSummary; delay: number }) {
  const { t } = useTranslation();
  const notDone = Math.max(0, s.total - s.completed);
  const cells = s.items.length > 0 ? s.items.map((i) => i.result) : Array.from({ length: s.total }, () => null);

  return (
    <Link href={href} className="grid grid-cols-[88px_1fr_auto] items-center gap-4 py-1.5 group ds-rise" style={{ animationDelay: `${delay}ms` }}>
      <span className="text-xs font-semibold text-text group-hover:text-primary transition-colors truncate">{t(`dashboard.inspect.${kind}`)}</span>
      <div className="flex gap-[2px] h-2.5">
        {cells.length === 0 ? (
          <span className="text-[11px] text-text-muted leading-none self-center">{t("dashboard.inspect.noTarget")}</span>
        ) : (
          cells.map((r, i) => (
            <span
              key={i}
              className={`flex-1 max-w-[18px] rounded-[1px] ${r ? RESULT_TONE[r] ?? "bg-success" : "bg-border"}`}
              title={s.items[i] ? `${s.items[i].equipName || s.items[i].equipCode} · ${r ?? t("dashboard.inspect.notDone")}` : undefined}
            />
          ))
        )}
      </div>
      <span className="font-mono text-[11px] tabular-nums text-text-muted whitespace-nowrap">
        <b className="text-text">{s.completed}</b>/{s.total}
        {s.fail > 0 && <span className="text-error ml-2">✕{s.fail}</span>}
        {notDone > 0 && <span className="ml-2">·{notDone}</span>}
      </span>
    </Link>
  );
}

export default function InspectRails({ summary }: { summary: DashboardSummary | null }) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted whitespace-nowrap">{t("dashboard.inspect.title")}</span>
        <span className="h-px flex-1 bg-border" />
        <span className="text-[10px] text-text-muted flex items-center gap-2">
          <span className="flex items-center gap-1"><i className="inline-block w-2 h-2 bg-success" />{t("dashboard.inspect.pass")}</span>
          <span className="flex items-center gap-1"><i className="inline-block w-2 h-2 bg-error" />{t("dashboard.inspect.fail")}</span>
          <span className="flex items-center gap-1"><i className="inline-block w-2 h-2 bg-border" />{t("dashboard.inspect.notDone")}</span>
        </span>
      </div>
      <div className="mt-1 divide-y divide-border/60">
        {RAILS.map((r, i) => (
          <Rail key={r.kind} kind={r.kind} href={r.href} s={summary?.[r.kind] ?? emptyInspect} delay={400 + i * 60} />
        ))}
      </div>
    </div>
  );
}
