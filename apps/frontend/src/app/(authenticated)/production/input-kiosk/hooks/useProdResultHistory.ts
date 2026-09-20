"use client";

/**
 * @file hooks/useProdResultHistory.ts
 * @description 현재 작업지시의 최근 생산실적 목록(GET /production/prod-results?orderNo=&limit=10) + 양품/불량 합계
 *
 * 초보자 가이드:
 * - WorkHistoryPanel 안에 있던 조회를 훅으로 뽑았다. B 배치는 합계 카드를 페이지 하단 띠로 옮겼는데,
 *   같은 목록을 두 곳(이력 패널·하단 띠)에서 쓰므로 페이지가 한 번 조회해 내려준다(중복 조회 금지).
 * - 합계는 이 목록(최근 10건) 기준이다. 서버 집계가 아니라는 점은 기존 패널과 같다.
 * - enabled=false 면 조회하지 않는다(부모가 history 를 내려주는 경우).
 */
import { useEffect, useState } from 'react';
import api from '@/services/api';

export interface HistoryItem {
  // 목록 API(GET /production/prod-results)는 PK를 resultNo로 반환한다(id 필드 없음)
  resultNo: string;
  // 생산실적의 제품 바코드는 PROD_RESULTS.PRD_UID로 반환된다.
  prdUid?: string;
  goodQty: number;
  defectQty: number;
  workerName?: string;
  startAt?: string;
  endAt?: string;
  createdAt?: string;
}

export function sumHistory(history: HistoryItem[]) {
  return {
    totalGood: history.reduce((s, h) => s + (h.goodQty ?? 0), 0),
    totalDefect: history.reduce((s, h) => s + (h.defectQty ?? 0), 0),
  };
}

export function useProdResultHistory(
  equipCode: string | null | undefined,
  orderNo: string | null | undefined,
  options: { refreshKey?: number; enabled?: boolean } = {},
) {
  const { refreshKey = 0, enabled = true } = options;
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (!enabled) return;
    if (!equipCode || !orderNo) { setHistory([]); return; }
    let cancelled = false;
    api.get('/production/prod-results', { params: { limit: '10', orderNo } })
      .then(res => { if (!cancelled) setHistory(res.data?.data ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [equipCode, orderNo, refreshKey, enabled]);

  return { history, ...sumHistory(history) };
}
