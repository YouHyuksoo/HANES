"use client";

/**
 * @file src/app/(authenticated)/dashboard/page.tsx
 * @description 대시보드 — 형태(레이아웃) × 색상(스킨) 두 축으로 갈아입는다.
 *
 *   형태 4종 (components/layouts.ts)
 *     콕핏   CockpitLayout : 오늘의 한 줄 → 가치흐름 리본 → 리듬/점검 → 조치 큐 (기본)
 *     전광판 BoardLayout   : 초대형 숫자 + 작업지시 출발 전광판(자동 순환) + 조치 큐
 *     노선도 FlowMapLayout : 물류/설비 라인의 역을 눌러 그 단계의 조치만 본다
 *     시계판 RadialLayout  : 24시간 원형 시계판 + 단계 압력 링 + 지금 바늘
 *   색상 3종 (components/skins.ts) — A 관제탑 / B 출발 전광판 / C 데이터 월. CSS 변수 오버라이드.
 *
 * 두 축은 독립이라 어떤 조합도 동작한다. 선택은 각각 localStorage(dashboard:layout / dashboard:skin)에 남고,
 * TV 모드는 모니터링 보드와 같은 전체화면 오버레이다.
 *
 * 초보자 가이드:
 * - 데이터/갱신은 useDashboardData, 예외 큐 산출은 buildAttention(순수 함수) 에 있다.
 * - 이 파일은 헤더 + 두 전환 그룹 + 형태 분기만 담당한다. 화면 구조는 각 Layout 컴포넌트에 있다.
 * - 색은 의미 토큰(text-primary/error/warning/success, border-border)만 쓴다. 파스텔 배경·카드박스 금지.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { useNow, formatClock } from "@/components/monitoring/BoardClock";
import { useBoardSkin, useTvMode } from "@/components/monitoring";
import {
  DASHBOARD_DEFAULT_SKIN, DASHBOARD_SKIN_IDS, DASHBOARD_SKIN_STORAGE_KEY, DASHBOARD_SKINS, type DashboardSkinId,
} from "./components/skins";
import {
  DASHBOARD_DEFAULT_LAYOUT, DASHBOARD_LAYOUT_IDS, DASHBOARD_LAYOUT_STORAGE_KEY, DASHBOARD_LAYOUTS, type DashboardLayoutId,
} from "./components/layouts";
import { useDashboardData } from "./components/useDashboardData";
import { buildAttention, attentionTotal } from "./components/buildAttention";
import CockpitLayout from "./components/CockpitLayout";
import BoardLayout from "./components/BoardLayout";
import FlowMapLayout from "./components/FlowMapLayout";
import RadialLayout from "./components/RadialLayout";

const MOTION_CSS = `
@keyframes ds-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.ds-rise { animation: ds-rise .55s cubic-bezier(.2,.7,.2,1) both; }
@keyframes ds-flow { to { stroke-dashoffset: -28; } }
.ds-flow { animation: ds-flow 1.2s linear infinite; }
@keyframes ds-blink { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }
.ds-blink { animation: ds-blink 1.4s ease-in-out infinite; }
@keyframes ds-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
.ds-grow { transform-origin: bottom; animation: ds-grow .6s cubic-bezier(.2,.7,.2,1) both; }
@media (prefers-reduced-motion: reduce) { .ds-rise, .ds-flow, .ds-blink, .ds-grow { animation: none; } }
`;

const LAYOUT_COMPONENT = {
  cockpit: CockpitLayout,
  board: BoardLayout,
  map: FlowMapLayout,
  radial: RadialLayout,
} as const satisfies Record<DashboardLayoutId, React.ComponentType<React.ComponentProps<typeof CockpitLayout>>>;

const segBtn = (active: boolean) =>
  `h-7 min-w-7 px-1.5 rounded text-xs font-bold flex items-center justify-center transition-colors ${
    active ? "bg-primary text-primary-foreground" : "text-text-muted hover:text-text hover:bg-muted"
  }`;

export default function DashboardPage() {
  const { t } = useTranslation();
  const { data, loading, updatedAt, refresh } = useDashboardData();
  const now = useNow();
  const clock = now ? formatClock(now) : null;

  const attention = useMemo(() => buildAttention(data), [data]);
  const attentionCount = attentionTotal(attention);

  const { skin: layoutId, setSkin: setLayout } = useBoardSkin<DashboardLayoutId>(DASHBOARD_LAYOUT_STORAGE_KEY, DASHBOARD_LAYOUT_IDS, DASHBOARD_DEFAULT_LAYOUT);
  const { skin: skinId, setSkin } = useBoardSkin<DashboardSkinId>(DASHBOARD_SKIN_STORAGE_KEY, DASHBOARD_SKIN_IDS, DASHBOARD_DEFAULT_SKIN);
  const { tvMode, toggleTvMode } = useTvMode();
  const skin = DASHBOARD_SKINS.find((item) => item.id === skinId) ?? DASHBOARD_SKINS[0];
  const Layout = LAYOUT_COMPONENT[layoutId];

  return (
    <div
      data-dashboard-skin={skin.id}
      data-dashboard-layout={layoutId}
      style={skin.vars}
      className={`${tvMode ? "fixed inset-0 z-50" : "h-full"} flex flex-col overflow-hidden bg-background text-text px-6 pt-5 pb-4 gap-4 ${skin.fontClass ?? ""}`}
    >
      <style>{MOTION_CSS}</style>

      {/* 헤더 */}
      <div className="flex items-end justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text tracking-tight">{t("dashboard.title")}</h1>
          <p className="text-xs text-text-muted mt-0.5">{t("dashboard.subtitle")}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right tabular-nums leading-none">
            <div className="text-[11px] uppercase tracking-[0.18em] text-text-muted">{clock?.date ?? ""}</div>
            <div className="text-2xl font-extrabold text-text mt-1">
              {clock?.hm ?? "--:--"}<span className="text-text-muted">:{clock?.sec ?? "--"}</span>
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-[11px] text-text-muted tabular-nums">
            {t("dashboard.updatedAt")} {updatedAt ? formatClock(updatedAt).hms : "--:--:--"}
          </div>
          <Button variant="secondary" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> {t("common.refresh")}
          </Button>
          <div className="h-8 w-px bg-border" />

          {/* 그룹 1: 형태 — 구조가 다른 대시보드 4종 */}
          <div className="flex items-center gap-1.5" role="group" aria-label={t("dashboard.layout.group")}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{t("dashboard.layout.group")}</span>
            <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
              {DASHBOARD_LAYOUTS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={t(item.titleKey)}
                    aria-label={t(item.titleKey)}
                    aria-pressed={item.id === layoutId}
                    onClick={() => setLayout(item.id)}
                    className={segBtn(item.id === layoutId)}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="ml-1 hidden 2xl:inline">{t(item.titleKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 그룹 2: 색상 — 같은 구조에 다른 팔레트 A/B/C (모니터링 보드와 같은 순서) + TV */}
          <div className="flex items-center gap-1.5" role="group" aria-label={t("dashboard.skinGroup")}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{t("dashboard.skinGroup")}</span>
            <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
              {DASHBOARD_SKINS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={t(item.titleKey)}
                  aria-label={t(item.titleKey)}
                  aria-pressed={item.id === skin.id}
                  onClick={() => setSkin(item.id)}
                  className={segBtn(item.id === skin.id)}
                >
                  {item.label}
                </button>
              ))}
              <span className="h-4 w-px bg-border mx-0.5" />
              <button
                type="button"
                title={t("dashboard.tvMode")}
                aria-label={t("dashboard.tvMode")}
                aria-pressed={tvMode}
                onClick={toggleTvMode}
                className={segBtn(tvMode)}
              >
                {tvMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Layout data={data} attention={attention} attentionCount={attentionCount} now={now} />
    </div>
  );
}
