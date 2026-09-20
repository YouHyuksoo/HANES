"use client";

/**
 * @file production/input-kiosk-b/components/KioskMetricsStrip.tsx
 * @description B 배치 하단 지표 띠 — CT · UPH · UPPH · 양품 합계 · 불량 합계 · 유실 합계를 한 줄, 한 양식으로
 *
 * 초보자 가이드:
 * - 상자(카드) 없이 "작은 라벨 위 / 큰 숫자 아래" 한 양식으로 6개를 나열하고 세로 구분선만 둔다.
 *   지표마다 다른 상자 모양·색을 쓰면 같은 정보가 다르게 보여 촌스럽고 헷갈린다(2026-09-20 지적).
 * - 숫자색: CT/UPH/UPPH 는 중립, 양품/불량/유실만 의미색(초록/빨강/황색). 배경 파스텔 금지.
 * - 값 출처: CT/UPH/UPPH = useOrderProductivity(기존 헤더와 같은 계산), 양품/불량 = 최근 실적 목록 합계,
 *   유실 = 설비정지 서버 집계(totalLossSeconds).
 */
import { useTranslation } from 'react-i18next';
import { CircleHelp } from 'lucide-react';
import HelpTooltip from '@/components/shared/HelpTooltip';
import { useOrderProductivity, formatMetric } from '../../input-kiosk/hooks/useOrderProductivity';
import { buildMetricDescriptions, PRODUCTIVITY_METRICS } from '../../input-kiosk/components/KioskProductivity';
import { formatDuration, type EquipStopSummary } from '../../input-kiosk/hooks/useEquipStop';

interface KioskMetricsStripProps {
  orderNo?: string;
  workers: number;
  refreshKey: number;
  totalGood: number;
  totalDefect: number;
  stopSummary?: EquipStopSummary;
}

function Metric({ label, value, unit, tone = 'text-text', help }: { label: React.ReactNode; value: string; unit?: string; tone?: string; help?: string }) {
  return (
    <div className="flex min-w-[112px] flex-col items-center justify-center border-l border-border px-5 first:border-l-0">
      <dt className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
        {help ? (
          <HelpTooltip description={help} focusable className="cursor-help items-center gap-1 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            {label}<CircleHelp className="h-3 w-3" aria-hidden="true" />
          </HelpTooltip>
        ) : label}
      </dt>
      <dd className={`flex items-baseline gap-1 leading-none ${tone}`}>
        <span className="text-2xl font-black tabular-nums" title={value}>{value}</span>
        {unit && <span className="text-[11px] font-medium text-text-muted">{unit}</span>}
      </dd>
    </div>
  );
}

export default function KioskMetricsStrip({ orderNo, workers, refreshKey, totalGood, totalDefect, stopSummary }: KioskMetricsStripProps) {
  const { t } = useTranslation();
  const { metrics, failed } = useOrderProductivity(orderNo, workers, refreshKey);
  const descriptions = buildMetricDescriptions(workers);
  const values = { CT: metrics.ct, UPH: metrics.uph, UPPH: metrics.upph };

  return (
    <dl data-testid="kiosk-b-metrics" className="flex h-full min-w-0 items-stretch overflow-x-auto py-1.5" title={failed ? t('kiosk.stepper.metricsFailed', '생산성 지표 조회 실패') : undefined}>
      {PRODUCTIVITY_METRICS.map(([label, unit]) => (
        <Metric key={label} label={label} value={formatMetric(values[label])} unit={unit} help={descriptions[label]} />
      ))}
      <Metric label={t('kiosk.history.goodTotal')} value={totalGood.toLocaleString()} unit="EA" tone="text-green-700 dark:text-green-400" />
      <Metric label={t('kiosk.history.defectTotal')} value={totalDefect.toLocaleString()} unit="EA" tone="text-red-600 dark:text-red-400" />
      <Metric label={t('kiosk.history.lossTotal', '유실 합계')} value={formatDuration(stopSummary?.totalLossSeconds ?? 0)} tone="text-amber-600 dark:text-amber-400" />
    </dl>
  );
}
