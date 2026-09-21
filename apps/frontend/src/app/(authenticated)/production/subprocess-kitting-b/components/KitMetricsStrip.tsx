"use client";

/**
 * @file production/subprocess-kitting-b/components/KitMetricsStrip.tsx
 * @description B 배치 하단 지표 띠 — CT · UPH · UPPH · 계획 · 투입 SFG 를 한 줄, 한 양식으로
 *
 * 초보자 가이드:
 * - 상자(카드) 없이 "작은 라벨 위 / 큰 숫자 아래" 한 양식으로 나열하고 세로 구분선만 둔다.
 *   지표마다 다른 상자 모양·색을 쓰면 같은 정보가 다르게 보여 헷갈린다(input-kiosk-b 와 같은 규칙).
 * - CT/UPH/UPPH 는 A안 AssemblyResultRow 안의 KioskProductivity 와 같은 계산(useOrderProductivity)을 쓴다.
 *   두 시안이 다른 수치를 보이면 비교가 불가능하므로 계산을 새로 만들지 않는다.
 * - 숫자색: CT/UPH/UPPH·계획은 중립, 투입 SFG 만 의미색(초록). 파스텔 배경은 쓰지 않는다.
 */
import { useTranslation } from 'react-i18next';
import { CircleHelp } from 'lucide-react';
import HelpTooltip from '@/components/shared/HelpTooltip';
import { useOrderProductivity, formatMetric } from '../../input-kiosk/hooks/useOrderProductivity';
import { buildMetricDescriptions, PRODUCTIVITY_METRICS } from '../../input-kiosk/components/KioskProductivity';

interface KitMetricsStripProps {
  orderNo?: string;
  planQty?: number;
  workers: number;
  refreshKey: number;
  scannedSg: number;
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

export default function KitMetricsStrip({ orderNo, planQty, workers, refreshKey, scannedSg }: KitMetricsStripProps) {
  const { t } = useTranslation();
  const { metrics, failed } = useOrderProductivity(orderNo, workers, refreshKey);
  const descriptions = buildMetricDescriptions(workers);
  const values = { CT: metrics.ct, UPH: metrics.uph, UPPH: metrics.upph };

  return (
    <dl
      data-testid="subkit-b-metrics"
      className="flex h-full min-w-0 items-stretch overflow-x-auto py-1.5"
      title={failed ? t('kiosk.stepper.metricsFailed', '생산성 지표 조회 실패') : undefined}
    >
      {PRODUCTIVITY_METRICS.map(([label, unit]) => (
        <Metric key={label} label={label} value={formatMetric(values[label])} unit={unit} help={descriptions[label]} />
      ))}
      <Metric label={t('kiosk.stepper.planQty', '계획')} value={(planQty ?? 0).toLocaleString()} unit="EA" />
      <Metric
        label={t('production.subprocess.scannedSg', '투입 SFG')}
        value={scannedSg.toLocaleString()}
        unit="EA"
        tone="text-green-700 dark:text-green-400"
      />
    </dl>
  );
}
