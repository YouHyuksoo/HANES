"use client";

/**
 * @file src/app/(authenticated)/dashboard/components/CockpitLayout.tsx
 * @description 형태 1 "콕핏" — 세 층으로 읽는 기본 대시보드.
 *   1) 오늘의 한 줄 (PulseLine)  2) 가치흐름 리본 + 리듬 + 점검 레일  3) 조치 필요 큐(드릴다운)
 */
import { useTranslation } from "react-i18next";
import type { DashboardLayoutProps } from "./layouts";
import PulseLine from "./PulseLine";
import ValueStream from "./ValueStream";
import RhythmStrip from "./RhythmStrip";
import InspectRails from "./InspectRails";
import AttentionQueue from "./AttentionQueue";

export default function CockpitLayout({ data, attention, attentionCount, now }: DashboardLayoutProps) {
  const { t } = useTranslation();
  return (
    <>
      <PulseLine data={data} attentionCount={attentionCount} />

      <div className="flex-1 min-h-0 flex gap-6">
        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto flex flex-col gap-5">
          <section className="flex-shrink-0">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted whitespace-nowrap">{t("dashboard.stream.title")}</span>
              <span className="h-px flex-1 bg-border" />
              <span className="text-[10px] text-text-muted">{t("dashboard.stream.hint")}</span>
            </div>
            <ValueStream data={data} />
          </section>

          <section className="flex-shrink-0 h-[190px] xl:h-[220px] flex flex-col">
            <RhythmStrip data={data} nowHour={now ? now.getHours() : null} />
          </section>

          <section className="flex-1 min-h-0 overflow-y-auto">
            <InspectRails summary={data.summary} />
          </section>
        </div>

        <aside className="w-[300px] xl:w-[340px] flex-shrink-0 min-h-0 border-l border-border pl-5">
          <AttentionQueue items={attention} total={attentionCount} />
        </aside>
      </div>
    </>
  );
}
