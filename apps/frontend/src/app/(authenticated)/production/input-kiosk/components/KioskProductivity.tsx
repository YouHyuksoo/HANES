"use client";

import { CircleHelp } from 'lucide-react';
import HelpTooltip from '@/components/shared/HelpTooltip';
import { useOrderProductivity, formatMetric } from '../hooks/useOrderProductivity';

/** 지표별 산출근거(도움말 툴팁). 헤더 표시와 B 배치 하단 띠가 같은 문구를 쓴다. */
export function buildMetricDescriptions(workers: number) {
  const basis = '총생산수량 = 현재 작업지시의 양품 + 불량\n경과시간 = 착수시각 ~ 조회시각 (완료 시 종료시각)\n비가동 시간 포함 · 30초마다 갱신\n수량 또는 유효한 시간이 없으면 — 표시';
  return {
    CT: `CT = 경과시간(초) ÷ 총생산수량\n단위: 초/EA · 제품 1개당 평균 소요시간\n${basis}`,
    UPH: `UPH = 총생산수량 ÷ 경과시간(시간)\n단위: EA/h · 시간당 생산수량\n${basis}`,
    UPPH: `UPPH = UPH ÷ 현재 배정 인원\n단위: EA/인·h · 1인당 시간당 생산수량\n현재 배정 인원: ${workers}명\n현재 인원 기준 추정값이며 과거 인원 변동은 반영하지 않음\n배정 인원이 0명이면 — 표시\n${basis}`,
  };
}

export const PRODUCTIVITY_METRICS = [['CT', 's/EA'], ['UPH', 'EA/h'], ['UPPH', 'EA/인·h']] as const;

/** Uses the same current-order server aggregate as the production total. 조회·계산은 hooks/useOrderProductivity. */
export default function KioskProductivity({ orderNo, workers, refreshKey, showTotal = false, planQty }: {
  orderNo?: string; workers: number; refreshKey: number; showTotal?: boolean; planQty?: number;
}) {
  const { current, total, metrics, failed } = useOrderProductivity(orderNo, workers, refreshKey);
  const format = formatMetric;
  const metricDescriptions = buildMetricDescriptions(workers);
  const values = { CT: metrics.ct, UPH: metrics.uph, UPPH: metrics.upph };
  return <>
    {showTotal && <div className="flex min-w-0 flex-wrap items-center justify-center gap-3 px-3" data-testid="kiosk-production-total">
      <span className="text-sm font-semibold text-text-muted">생산실적</span>
      <strong className="text-4xl font-extrabold tabular-nums text-primary">{current ? format(total) : '—'}</strong>
      <span className="text-sm text-text-muted">/ {planQty?.toLocaleString() ?? '—'} EA</span>
    </div>}
    <dl data-testid="kiosk-productivity" className="grid min-w-0 grid-cols-3 gap-2 border-l border-border px-4">
    {PRODUCTIVITY_METRICS.map(([label, unit]) =>
      <div key={label} className="min-w-0 text-center">
        <dt className="text-xs font-semibold text-black/60 dark:text-white/60">
          <HelpTooltip description={metricDescriptions[label]} dataField={`productivity-${label.toLowerCase()}`} focusable className="cursor-help items-center gap-1 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            {label}<CircleHelp className="h-3 w-3" aria-hidden="true" />
          </HelpTooltip>
        </dt>
        <dd className="truncate text-xl font-bold tabular-nums text-primary" title={format(values[label])}>{format(values[label])}</dd>
        <dd className="text-[10px] text-black/50 dark:text-white/50">{unit}</dd>
      </div>)}
    <div className="col-span-3 text-center text-[10px] text-black/50 dark:text-white/50">{failed ? '조회 실패' : '경과시간 기준 · UPPH 현재 인원 추정'}</div>
    </dl></>;
}
