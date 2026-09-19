"use client";

import { useEffect, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import HelpTooltip from '@/components/shared/HelpTooltip';
import api from '@/services/api';
import { kioskProductivity } from '../utils/kioskProductivity';

interface OrderTiming { startAt?: string | null; endAt?: string | null; goodQty?: number; defectQty?: number }

/** Uses the same current-order server aggregate as the production total. */
export default function KioskProductivity({ orderNo, workers, refreshKey, showTotal = false, planQty }: {
  orderNo?: string; workers: number; refreshKey: number; showTotal?: boolean; planQty?: number;
}) {
  const [snapshot, setSnapshot] = useState<{ orderNo: string; data: OrderTiming; at: number } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!orderNo) return;
    const refresh = async () => {
      try {
        const response = await api.get(`/production/job-orders/order-no/${encodeURIComponent(orderNo)}`, { suppressErrorModal: true });
        if (!cancelled) {
          setSnapshot({ orderNo, data: response.data?.data ?? {}, at: Date.now() });
          setFailed(false);
        }
      } catch { if (!cancelled) setFailed(true); }
      finally { if (!cancelled) timer = setTimeout(refresh, 30000); }
    };
    void refresh();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [orderNo, refreshKey]);
  const current = !failed && snapshot?.orderNo === orderNo ? snapshot : null;
  const metrics = kioskProductivity(Number(current?.data.goodQty ?? 0) + Number(current?.data.defectQty ?? 0),
    current?.data.startAt, current?.data.endAt, workers, current?.at ?? 0);
  const format = (value: number | null) => value === null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  const basis = '총생산수량 = 현재 작업지시의 양품 + 불량\n경과시간 = 착수시각 ~ 조회시각 (완료 시 종료시각)\n비가동 시간 포함 · 30초마다 갱신\n수량 또는 유효한 시간이 없으면 — 표시';
  const metricDescriptions = {
    CT: `CT = 경과시간(초) ÷ 총생산수량\n단위: 초/EA · 제품 1개당 평균 소요시간\n${basis}`,
    UPH: `UPH = 총생산수량 ÷ 경과시간(시간)\n단위: EA/h · 시간당 생산수량\n${basis}`,
    UPPH: `UPPH = UPH ÷ 현재 배정 인원\n단위: EA/인·h · 1인당 시간당 생산수량\n현재 배정 인원: ${workers}명\n현재 인원 기준 추정값이며 과거 인원 변동은 반영하지 않음\n배정 인원이 0명이면 — 표시\n${basis}`,
  };
  return <>
    {showTotal && <div className="flex min-w-0 flex-wrap items-center justify-center gap-3 px-3" data-testid="kiosk-production-total">
      <span className="text-sm font-semibold text-text-muted">생산실적</span>
      <strong className="text-4xl font-extrabold tabular-nums text-primary">{current ? format(Number(current.data.goodQty ?? 0) + Number(current.data.defectQty ?? 0)) : '—'}</strong>
      <span className="text-sm text-text-muted">/ {planQty?.toLocaleString() ?? '—'} EA</span>
    </div>}
    <dl data-testid="kiosk-productivity" className="grid min-w-0 grid-cols-3 gap-2 border-l border-border px-4">
    {([['CT', metrics.ct, 's/EA'], ['UPH', metrics.uph, 'EA/h'], ['UPPH', metrics.upph, 'EA/인·h']] as const).map(([label, value, unit]) =>
      <div key={label} className="min-w-0 text-center">
        <dt className="text-xs font-semibold text-black/60 dark:text-white/60">
          <HelpTooltip description={metricDescriptions[label]} dataField={`productivity-${label.toLowerCase()}`} focusable className="cursor-help items-center gap-1 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            {label}<CircleHelp className="h-3 w-3" aria-hidden="true" />
          </HelpTooltip>
        </dt>
        <dd className="truncate text-xl font-bold tabular-nums text-primary" title={format(value)}>{format(value)}</dd>
        <dd className="text-[10px] text-black/50 dark:text-white/50">{unit}</dd>
      </div>)}
    <div className="col-span-3 text-center text-[10px] text-black/50 dark:text-white/50">{failed ? '조회 실패' : '경과시간 기준 · UPPH 현재 인원 추정'}</div>
  </dl></>;
}
