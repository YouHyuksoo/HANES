'use client';

/**
 * @file components/useLabelIssue.ts
 * @description 라벨 발행 비즈니스 로직 훅 - matUid 생성, 자동입고, 인쇄 로그 처리
 *
 * 초보자 가이드:
 * 1. 선택된 입하 건에 대해 POST /material/receive-label/create 호출 → matUid 생성
 * 2. 자동입고 설정 시 생성된 matUid로 자동입고 처리
 * 3. 인쇄 로그 기록 (브라우저 인쇄 완료 후)
 * 4. page.tsx에서 이 훅을 사용하여 발행 흐름을 제어
 */
import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { LabelableArrival } from './useReceiveLabelColumns';

/** POST create 응답 아이템 */
export interface CreatedMatUid {
  matUid: string;
  itemCode: string;
  itemName: string;
  supUid: string | null;
}

/** 자동입고 결과 */
export interface AutoReceiveResult {
  received: string[];
  skipped: string[];
  warehouseName?: string;
}

interface UseLabelIssueParams {
  /** 필터링된 입하 목록 */
  filteredArrivals: LabelableArrival[];
  /** 선택된 입하 id Set */
  selectedIds: Set<number>;
  /** 자동입고 활성 여부 */
  isAutoReceive: boolean;
  /** 데이터 새로고침 콜백 */
  onRefresh: () => void;
}

/** 라벨 발행 비즈니스 로직 훅 */
export function useLabelIssue({
  filteredArrivals, selectedIds, isAutoReceive, onRefresh,
}: UseLabelIssueParams) {
  const [issuing, setIssuing] = useState(false);
  const [createdUids, setCreatedUids] = useState<CreatedMatUid[]>([]);
  const [autoReceiveResult, setAutoReceiveResult] = useState<AutoReceiveResult | null>(null);

  /** 선택된 입하 건에 대해 matUid 생성 (POST create) */
  const createMatUids = useCallback(async (): Promise<CreatedMatUid[]> => {
    const selected = filteredArrivals.filter((a) => selectedIds.has(a.id));
    if (selected.length === 0) return [];

    setIssuing(true);
    const allCreated: CreatedMatUid[] = [];
    try {
      for (const arrival of selected) {
        const res = await api.post('/material/receive-label/create', {
          arrivalId: arrival.id,
          qty: arrival.qty,
          supUid: arrival.supUid ?? undefined,
        });
        const items: CreatedMatUid[] = res.data?.data ?? res.data ?? [];
        allCreated.push(...items);
      }
      setCreatedUids(allCreated);
      return allCreated;
    } catch (err) {
      console.error('Failed to create matUids:', err);
      return allCreated;
    } finally {
      setIssuing(false);
    }
  }, [filteredArrivals, selectedIds]);

  /** 자동입고 처리 */
  const handleAutoReceive = useCallback(async (matUids: string[]) => {
    if (!isAutoReceive || matUids.length === 0) return;
    try {
      const res = await api.post('/material/receiving/auto', { matUids });
      const result = res.data?.data;
      if (result) {
        setAutoReceiveResult(result);
        if (result.received?.length > 0) onRefresh();
      }
    } catch (err) { console.error('Auto-receive failed:', err); }
  }, [isAutoReceive, onRefresh]);

  /** 브라우저 인쇄 로그 기록 */
  const logBrowserPrint = useCallback(async (matUids: string[]) => {
    try {
      await api.post('/material/label-print/log', {
        category: 'mat_lot', printMode: 'BROWSER',
        matUids, labelCount: matUids.length, status: 'SUCCESS',
      });
    } catch { /* ignore logging errors */ }
  }, []);

  /** 생성 결과 초기화 */
  const clearCreatedUids = useCallback(() => setCreatedUids([]), []);

  /** 자동입고 결과 초기화 */
  const clearAutoReceiveResult = useCallback(() => setAutoReceiveResult(null), []);

  return {
    issuing,
    createdUids,
    autoReceiveResult,
    createMatUids,
    handleAutoReceive,
    logBrowserPrint,
    clearCreatedUids,
    clearAutoReceiveResult,
  };
}
