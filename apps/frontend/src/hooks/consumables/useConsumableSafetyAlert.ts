/**
 * @file src/hooks/consumables/useConsumableSafetyAlert.ts
 * @description 소모품 안전재고 사전알림 데이터 훅
 *
 * 판정은 서버가 @harness/shared 규칙으로 끝내서 내려준다. 여기서 다시 계산하지 말 것.
 * 기본 조회는 조치가 필요한 건(부족·사전경고)만 가져온다 — 목록 화면은 전량 조회하지 않는다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ConsumableSafetyLevel } from '@harness/shared';
import { CONSUMABLE_PRE_ALERT_RATIO_DEFAULT } from '@harness/shared';
import { api } from '@/services/api';

export interface ConsumableSafetyRow {
  consumableCode: string;
  name: string;
  category: string | null;
  safetyStock: number;
  availableQty: number;
  replacingQty: number;
  wornOutQty: number;
  effectiveQty: number;
  shortageQty: number;
  preAlertThreshold: number;
  level: ConsumableSafetyLevel;
  location: string | null;
  vendor: string | null;
}

export function useConsumableSafetyAlert() {
  const [data, setData] = useState<ConsumableSafetyRow[]>([]);
  const [ratio, setRatio] = useState<number>(CONSUMABLE_PRE_ALERT_RATIO_DEFAULT);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  /** 기본값 true — 조치가 필요한 것만 본다 */
  const [onlyActionNeeded, setOnlyActionNeeded] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/consumables/safety-stock', {
        params: {
          onlyActionNeeded: onlyActionNeeded ? 'Y' : 'N',
          category: categoryFilter || undefined,
          search: searchTerm.trim() || undefined,
        },
      });
      setData(res.data?.data ?? []);
      if (typeof res.data?.ratio === 'number') setRatio(res.data.ratio);
    } catch {
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [onlyActionNeeded, categoryFilter, searchTerm]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const summary = useMemo(() => ({
    shortage: data.filter((r) => r.level === 'SHORTAGE').length,
    preAlert: data.filter((r) => r.level === 'PRE_ALERT').length,
    notManaged: data.filter((r) => r.level === 'NOT_MANAGED').length,
  }), [data]);

  return {
    data,
    ratio,
    summary,
    isLoading,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    onlyActionNeeded,
    setOnlyActionNeeded,
    refresh: fetchData,
  };
}
