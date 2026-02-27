"use client";

/**
 * @file src/app/(authenticated)/material/receive-history/page.tsx
 * @description 입고이력조회 페이지 - MAT_RECEIVINGS 기반 입고 이력 조회
 *
 * 초보자 가이드:
 * 1. RECEIVE 타입 StockTransaction 이력을 표시하는 조회 전용 페이지
 * 2. 입고번호, 입고일, LOT번호, 품목, 수량, 창고 등 표시
 * 3. 컬럼 필터 및 페이지네이션 지원
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, RefreshCw, CheckCircle, Hash } from 'lucide-react';
import { Card, CardContent, Button, StatCard } from '@/components/ui';
import api from '@/services/api';
import ReceivingHistoryTable from '../receive/components/ReceivingHistoryTable';
import type { ReceivingRecord, ReceivingStats } from '../receive/components/types';

const INITIAL_STATS: ReceivingStats = { pendingCount: 0, pendingQty: 0, todayReceivedCount: 0, todayReceivedQty: 0 };

export default function ReceiveHistoryPage() {
  const { t } = useTranslation();

  const [history, setHistory] = useState<ReceivingRecord[]>([]);
  const [stats, setStats] = useState<ReceivingStats>(INITIAL_STATS);
  const [loading, setLoading] = useState(false);

  /** 입고 이력 조회 */
  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get('/material/receiving', { params: { page: 1, limit: 50 } });
      setHistory(res.data.data || []);
    } catch { setHistory([]); }
  }, []);

  /** 통계 조회 */
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/material/receiving/stats');
      setStats(res.data.data || INITIAL_STATS);
    } catch { /* 무시 */ }
  }, []);

  /** 새로고침 */
  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchHistory(), fetchStats()]);
    setLoading(false);
  }, [fetchHistory, fetchStats]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            {t('material.receiveHistory.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('material.receiveHistory.description')}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh}>
          <RefreshCw className="w-4 h-4 mr-1" /> {t('common.refresh')}
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label={t('material.receive.stats.todayReceivedCount')} value={stats.todayReceivedCount} icon={CheckCircle} color="green" />
        <StatCard label={t('material.receive.stats.todayReceivedQty')} value={stats.todayReceivedQty} icon={Hash} color="purple" />
      </div>

      {/* 이력 테이블 */}
      <Card>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-text-muted">{t('common.loading')}</div>
          ) : (
            <ReceivingHistoryTable data={history} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
