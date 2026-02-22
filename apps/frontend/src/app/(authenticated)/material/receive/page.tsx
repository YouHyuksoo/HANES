"use client";

/**
 * @file src/app/(authenticated)/material/receive/page.tsx
 * @description 입고관리 페이지 - IQC 합격건 일괄/분할 입고 등록
 *
 * 초보자 가이드:
 * 1. **입고대기 탭**: IQC 합격 LOT 중 미입고 건을 체크박스로 선택 → 수량/창고 입력 → 일괄 입고
 * 2. **입고이력 탭**: RECEIVE 타입 StockTransaction 이력 표시
 * 3. **분할 입고**: 잔량 범위 내에서 일부 수량만 입고 가능
 * 4. **통계 카드**: 입고대기 건수/수량, 금일 입고건수/수량
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PackagePlus, Clock, Package, CheckCircle, Hash, RefreshCw } from 'lucide-react';
import { Card, CardContent, Button, StatCard } from '@/components/ui';
import api from '@/services/api';
import ReceivableTable from './components/ReceivableTable';
import ReceivingHistoryTable from './components/ReceivingHistoryTable';
import type { ReceivableLot, ReceivingRecord, ReceivingStats, ReceiveInput } from './components/types';

const INITIAL_STATS: ReceivingStats = { pendingCount: 0, pendingQty: 0, todayReceivedCount: 0, todayReceivedQty: 0 };

export default function ReceivingPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'pending' | 'history'>('pending');

  const [receivable, setReceivable] = useState<ReceivableLot[]>([]);
  const [history, setHistory] = useState<ReceivingRecord[]>([]);
  const [stats, setStats] = useState<ReceivingStats>(INITIAL_STATS);
  const [inputs, setInputs] = useState<Record<string, ReceiveInput>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /** 입고 가능 LOT 조회 */
  const fetchReceivable = useCallback(async () => {
    try {
      const res = await api.get('/material/receiving/receivable');
      const lots: ReceivableLot[] = res.data.data || [];
      setReceivable(lots);
      const init: Record<string, ReceiveInput> = {};
      lots.forEach((lot) => {
        init[lot.id] = {
          lotId: lot.id,
          qty: lot.remainingQty,
          warehouseId: lot.arrivalWarehouse?.id || '',
          manufactureDate: lot.manufactureDate ? String(lot.manufactureDate).slice(0, 10) : '',
          selected: false,
        };
      });
      setInputs(init);
    } catch { setReceivable([]); }
  }, []);

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

  /** 전체 새로고침 */
  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchReceivable(), fetchHistory(), fetchStats()]);
    setLoading(false);
  }, [fetchReceivable, fetchHistory, fetchStats]);

  useEffect(() => { refresh(); }, [refresh]);

  /** 입력 변경 핸들러 */
  const handleInputChange = (lotId: string, field: keyof ReceiveInput, value: string | number | boolean) => {
    setInputs((prev) => ({ ...prev, [lotId]: { ...prev[lotId], [field]: value } }));
  };

  /** 전체 선택 */
  const handleSelectAll = (checked: boolean) => {
    setInputs((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => { next[k] = { ...next[k], selected: checked }; });
      return next;
    });
  };

  const allSelected = receivable.length > 0 && receivable.every((lot) => inputs[lot.id]?.selected);
  const selectedItems = Object.values(inputs).filter((inp) => inp.selected && inp.qty > 0);

  /** 일괄 입고 등록 */
  const handleBulkReceive = async () => {
    if (selectedItems.length === 0) return;
    setSubmitting(true);
    try {
      await api.post('/material/receiving', {
        items: selectedItems.map(({ lotId, qty, warehouseId, manufactureDate }) => ({
          lotId, qty, warehouseId,
          ...(manufactureDate && { manufactureDate }),
        })),
      });
      refresh();
    } catch { /* 에러는 API 인터셉터에서 처리 */ }
    setSubmitting(false);
  };

  const tabClass = (key: string) =>
    `px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
      tab === key ? 'border-primary text-primary bg-surface' : 'border-transparent text-text-muted hover:text-text'
    }`;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <PackagePlus className="w-7 h-7 text-primary" />
            {t('material.receive.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('material.receive.description')}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh}>
          <RefreshCw className="w-4 h-4 mr-1" /> {t('common.refresh')}
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t('material.receive.stats.pendingCount')} value={stats.pendingCount} icon={Clock} color="yellow" />
        <StatCard label={t('material.receive.stats.pendingQty')} value={stats.pendingQty} icon={Package} color="blue" />
        <StatCard label={t('material.receive.stats.todayReceivedCount')} value={stats.todayReceivedCount} icon={CheckCircle} color="green" />
        <StatCard label={t('material.receive.stats.todayReceivedQty')} value={stats.todayReceivedQty} icon={Hash} color="purple" />
      </div>

      {/* 탭 + 콘텐츠 */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-1 mb-4 border-b border-border">
            <button className={tabClass('pending')} onClick={() => setTab('pending')}>
              {t('material.receive.tabPending')} ({receivable.length})
            </button>
            <button className={tabClass('history')} onClick={() => setTab('history')}>
              {t('material.receive.tabHistory')} ({history.length})
            </button>
            {tab === 'pending' && selectedItems.length > 0 && (
              <div className="ml-auto mb-1">
                <Button size="sm" onClick={handleBulkReceive} disabled={submitting}>
                  <PackagePlus className="w-4 h-4 mr-1" />
                  {t('material.receive.bulkReceive')} ({selectedItems.length})
                </Button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="py-10 text-center text-text-muted">{t('common.loading')}</div>
          ) : tab === 'pending' ? (
            <ReceivableTable
              data={receivable}
              inputs={inputs}
              onInputChange={handleInputChange}
              onSelectAll={handleSelectAll}
              allSelected={allSelected}
            />
          ) : (
            <ReceivingHistoryTable data={history} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
