"use client";

/**
 * @file src/app/(authenticated)/dashboard/components/ValueStream.tsx
 * @description 가치흐름 리본 — 입고 → 자재 → 생산 → 품질 → 제품 5단계를 좌→우 흐름선으로 잇고,
 *              단계마다 대표 숫자 1개 + 보조 지표 2줄 + 압력 게이지(12칸 LED)를 보여준다.
 *              단계 클릭 시 해당 업무 화면으로 이동한다.
 *
 * 초보자 가이드:
 * 1. "압력" = 그 단계에서 사람이 처리해야 할 예외 건수. 0 이면 게이지가 꺼진다.
 * 2. 흐름선의 점선 애니메이션은 CSS 만 사용한다 (ds-flow keyframes 는 page.tsx 에 정의).
 */
import Link from "next/link";
import { useTranslation } from "react-i18next";
import type { DashboardData } from "./types";

const GAUGE_SEGMENTS = 12;

interface StageDef {
  key: "receive" | "material" | "production" | "quality" | "product";
  href: string;
  hero: string;
  heroUnit?: string;
  heroTone: string;
  lines: Array<{ label: string; value: number | string; tone?: string }>;
  pressure: number;
}

function formatNum(n: number) {
  return n.toLocaleString();
}

function Gauge({ pressure }: { pressure: number }) {
  const lit = Math.min(GAUGE_SEGMENTS, pressure);
  const tone = pressure >= 6 ? "bg-error" : pressure > 0 ? "bg-warning" : "bg-success";
  return (
    <div className="flex gap-[3px] mt-3" aria-hidden>
      {Array.from({ length: GAUGE_SEGMENTS }, (_, i) => (
        <span
          key={i}
          className={`h-[5px] flex-1 rounded-[1px] transition-colors duration-500 ${i < lit ? tone : "bg-border"}`}
          style={i < lit ? { transitionDelay: `${i * 30}ms` } : undefined}
        />
      ))}
    </div>
  );
}

function FlowConnector({ active }: { active: boolean }) {
  return (
    <div className="w-8 xl:w-10 flex-shrink-0 self-center -mt-6" aria-hidden>
      <svg viewBox="0 0 40 12" className="w-full h-3 overflow-visible">
        <line x1="0" y1="6" x2="40" y2="6" className="stroke-border" strokeWidth="1" />
        {active && (
          <line x1="0" y1="6" x2="40" y2="6" className="stroke-primary ds-flow" strokeWidth="2" strokeDasharray="6 8" strokeLinecap="round" />
        )}
        <path d="M34 2 L40 6 L34 10" fill="none" className={active ? "stroke-primary" : "stroke-border"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default function ValueStream({ data }: { data: DashboardData }) {
  const { t } = useTranslation();
  const { summary, production, quality, inventory } = data;

  const expired = inventory?.kpi.expiredCount ?? summary?.mat.expired ?? 0;
  const nearExpiry = inventory?.kpi.nearExpiryCount ?? summary?.mat.nearExpiry ?? 0;
  const shortage = inventory?.kpi.shortageCount ?? summary?.mat.lowStock ?? 0;
  const matHold = inventory?.holds.filter((h) => h.kind === "MATERIAL").length ?? 0;
  const prodHold = inventory?.holds.filter((h) => h.kind === "PRODUCT").length ?? 0;
  const holdOrders = production?.orders.filter((o) => o.status === "HOLD").length ?? 0;
  const equipStop = summary?.equip.stop ?? 0;
  const defectRate = quality?.kpi.defectRate ?? 0;

  const stages: StageDef[] = [
    {
      key: "receive",
      href: "/material/receive-history",
      hero: formatNum(inventory?.kpi.inCount ?? 0),
      heroUnit: t("dashboard.stream.countUnit"),
      heroTone: "text-text",
      lines: [
        { label: t("dashboard.stream.expired"), value: expired, tone: expired > 0 ? "text-error" : undefined },
        { label: t("dashboard.stream.nearExpiry"), value: nearExpiry, tone: nearExpiry > 0 ? "text-warning" : undefined },
      ],
      pressure: expired + nearExpiry,
    },
    {
      key: "material",
      href: "/inventory/material-stock",
      hero: formatNum(inventory?.kpi.outCount ?? 0),
      heroUnit: t("dashboard.stream.countUnit"),
      heroTone: "text-text",
      lines: [
        { label: t("dashboard.stream.shortage"), value: shortage, tone: shortage > 0 ? "text-warning" : undefined },
        { label: t("dashboard.stream.hold"), value: matHold, tone: matHold > 0 ? "text-error" : undefined },
      ],
      pressure: shortage + matHold,
    },
    {
      key: "production",
      href: "/production/order-result",
      hero: formatNum(production?.kpi.goodQty ?? 0),
      heroUnit: `/ ${formatNum(production?.kpi.planQty ?? 0)}`,
      heroTone: "text-primary",
      lines: [
        {
          label: t("dashboard.stream.orders"),
          value: `${summary?.job.running ?? 0} · ${summary?.job.wait ?? 0} · ${holdOrders}`,
          tone: holdOrders > 0 ? "text-warning" : undefined,
        },
        {
          label: t("dashboard.stream.equipRun"),
          value: `${summary?.equip.normal ?? 0} / ${summary?.equip.total ?? 0}`,
          tone: equipStop > 0 ? "text-error" : undefined,
        },
      ],
      pressure: holdOrders + equipStop,
    },
    {
      key: "quality",
      href: "/quality/defect",
      hero: defectRate.toFixed(1),
      heroUnit: "%",
      heroTone: defectRate >= 3 ? "text-error" : "text-text",
      lines: [
        { label: t("dashboard.stream.defectWait"), value: summary?.defect.wait ?? 0, tone: (summary?.defect.wait ?? 0) > 0 ? "text-error" : undefined },
        {
          label: t("dashboard.stream.repair"),
          value: `${quality?.repair.received ?? 0} · ${quality?.repair.inRepair ?? 0}`,
          tone: (quality?.repair.received ?? 0) > 0 ? "text-warning" : undefined,
        },
      ],
      pressure: (summary?.defect.wait ?? 0) + (quality?.repair.received ?? 0),
    },
    {
      key: "product",
      href: "/production/fg-stock",
      hero: formatNum(summary?.job.done ?? 0),
      heroUnit: `/ ${formatNum(summary?.job.total ?? 0)}`,
      heroTone: "text-text",
      lines: [
        { label: t("dashboard.stream.productHold"), value: prodHold, tone: prodHold > 0 ? "text-error" : undefined },
        { label: t("dashboard.stream.repairDone"), value: quality?.repair.completedToday ?? 0 },
      ],
      pressure: prodHold,
    },
  ];

  return (
    <div className="flex items-stretch">
      {stages.map((s, i) => (
        <div key={s.key} className="contents">
          {i > 0 && <FlowConnector active={(production?.kpi.runningCount ?? 0) > 0} />}
          <Link
            href={s.href}
            className="flex-1 min-w-0 group ds-rise"
            style={{ animationDelay: `${120 + i * 90}ms` }}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-text-muted">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-text group-hover:text-primary transition-colors">
                {t(`dashboard.stream.${s.key}`)}
              </span>
              {s.pressure > 0 && (
                <span className="ml-auto font-mono text-[11px] font-semibold text-warning border border-warning/60 rounded-sm px-1 leading-4">
                  +{s.pressure}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className={`text-3xl xl:text-4xl font-extrabold tabular-nums leading-none tracking-tight ${s.heroTone}`}>{s.hero}</span>
              {s.heroUnit && <span className="text-xs font-medium text-text-muted tabular-nums truncate">{s.heroUnit}</span>}
            </div>
            <div className="text-[11px] text-text-muted mt-0.5">{t(`dashboard.stream.${s.key}Hero`)}</div>
            <dl className="mt-3 space-y-1">
              {s.lines.map((l) => (
                <div key={l.label} className="flex items-baseline justify-between gap-2 text-xs">
                  <dt className="text-text-muted truncate">{l.label}</dt>
                  <dd className={`font-semibold tabular-nums whitespace-nowrap ${l.tone ?? "text-text"}`}>{l.value}</dd>
                </div>
              ))}
            </dl>
            <Gauge pressure={s.pressure} />
          </Link>
        </div>
      ))}
    </div>
  );
}
