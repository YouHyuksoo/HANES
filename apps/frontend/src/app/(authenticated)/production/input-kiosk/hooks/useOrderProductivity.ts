"use client";

/**
 * @file hooks/useOrderProductivity.ts
 * @description 현재 작업지시의 서버 집계(착수/종료 시각·양품·불량)를 30초마다 받아 CT/UPH/UPPH 를 계산한다
 *
 * 초보자 가이드:
 * - KioskProductivity 컴포넌트 안에 있던 조회·계산을 훅으로 뽑았다. 기존 헤더용 표시(KioskProductivity)와
 *   B 배치 하단 지표 띠(KioskMetricsStrip)가 같은 값을 쓴다. 계산식은 utils/kioskProductivity 단일 출처.
 * - 총생산수량 = 양품 + 불량. 경과시간 = 착수 ~ 조회시각(완료 시 종료시각).
 */
import { useEffect, useState } from 'react';
import api from '@/services/api';
import { kioskProductivity } from '../utils/kioskProductivity';

export interface OrderTiming { startAt?: string | null; endAt?: string | null; goodQty?: number; defectQty?: number }

export function formatMetric(value: number | null) {
  return value === null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function useOrderProductivity(orderNo: string | undefined, workers: number, refreshKey: number) {
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
  const total = current ? Number(current.data.goodQty ?? 0) + Number(current.data.defectQty ?? 0) : null;
  const metrics = kioskProductivity(total ?? 0, current?.data.startAt, current?.data.endAt, workers, current?.at ?? 0);

  return { current, total, metrics, failed };
}
