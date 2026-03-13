"use client";

/**
 * @file src/app/(authenticated)/material/receive/page.tsx
 * @description 자재입고관리 페이지 - IQC 합격건 일괄/분할 입고 등록
 *
 * 초보자 가이드:
 * 1. IQC 합격 LOT 중 미입고 건을 체크박스로 선택 -> 수량/창고 입력 -> 일괄 입고
 * 2. 분할 입고: 잔량 범위 내에서 일부 수량만 입고 가능
 * 3. 통계 카드: 입고대기 건수/수량, 금일 입고건수/수량
 * 4. 입고이력은 별도 페이지(/material/receive-history)에서 조회
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PackagePlus, Clock, Package, CheckCircle, Hash, RefreshCw, Search } from 'lucide-react';
import { Card, CardContent, Button, Input, StatCard } from '@/components/ui';
import api from '@/services/api';
import ReceivableTable from './components/ReceivableTable';
import type { ReceivableLot, ReceivingStats, ReceiveInput } from './components/types';

const INITIAL_STATS: ReceivingStats = { pendingCount: 0, pendingQty: 0, todayReceivedCount: 0, todayReceivedQty: 0 };

export default function ReceivingPage() {
  const { t } = useTranslation();

  const [receivable, setReceivable] = useState<ReceivableLot[]>([]);
  const [stats, setStats] = useState<ReceivingStats>(INITIAL_STATS);
  const [inputs, setInputs] = useState<Record<string, ReceiveInput>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchText, setSearchText] = useState('');

  /** 입고 가능 LOT 조회 */
  const fetchReceivable = useCallback(async () => {
    try {
      const res = await api.get('/material/receiving/receivable');
      const lots: ReceivableLot[] = res.data.data || [];
      setReceivable(lots);
      const init: Record<string, ReceiveInput> = {};
      lots.forEach((lot) => {
        init[lot.matUid] = {
          matUid: lot.matUid,
          qty: lot.remainingQty,
          warehouseCode: lot.arrivalWarehouseCode || '',
          manufactureDate: lot.manufactureDate ? String(lot.manufactureDate).slice(0, 10) : '',
          selected: false,
        };
      });
      setInputs(init);
    } catch { setReceivable([]); }
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
    await Promise.all([fetchReceivable(), fetchStats()]);
    setLoading(false);
  }, [fetchReceivable, fetchStats]);

  useEffect(() => { refresh(); }, [refresh]);

  /** 입력 변경 핸들러 */
  const handleInputChange = (matUid: string, field: keyof ReceiveInput, value: string | number | boolean) => {
    setInputs((prev) => ({ ...prev, [matUid]: { ...prev[matUid], [field]: value } }));
  };

  /** 전체 선택 */
  const handleSelectAll = (checked: boolean) => {
    setInputs((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => { next[k] = { ...next[k], selected: checked }; });
      return next;
    });
  };

  /** 검색 필터링 */
  const filtered = searchText
    ? receivable.filter((lot) => {
        const q = searchText.toLowerCase();
        return lot.matUid.toLowerCase().includes(q)
          || lot.part?.itemCode?.toLowerCase().includes(q)
          || lot.part?.itemName?.toLowerCase().includes(q)
          || lot.vendor?.toLowerCase().includes(q)
          || lot.poNo?.toLowerCase().includes(q);
      })
    : receivable;

  const allSelected = filtered.length > 0 && filtered.every((lot) => inputs[lot.matUid]?.selected);
  const selectedItems = Object.values(inputs).filter((inp) => inp.selected && inp.qty > 0);

  /** 일괄 입고 등록 */
  const handleBulkReceive = async () => {
    if (selectedItems.length === 0) return;
    setSubmitting(true);
    try {
      await api.post('/material/receiving', {
        items: selectedItems.map(({ matUid, qty, warehouseCode, manufactureDate }) => ({
          matUid, qty, warehouseCode,
          ...(manufactureDate && { manufactureDate }),
        })),
      });
      refresh();
    } catch { /* 에러는 API 인터셉터에서 처리 */ }
    setSubmitting(false);
  };

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
        {selectedItems.length > 0 && (
          <Button size="sm" onClick={handleBulkReceive} disabled={submitting}>
            <PackagePlus className="w-4 h-4 mr-1" />
            {t('material.receive.bulkReceive')} ({selectedItems.length})
          </Button>
        )}
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t('material.receive.stats.pendingCount')} value={stats.pendingCount} icon={Clock} color="yellow" />
        <StatCard label={t('material.receive.stats.pendingQty')} value={stats.pendingQty} icon={Package} color="blue" />
        <StatCard label={t('material.receive.stats.todayReceivedCount')} value={stats.todayReceivedCount} icon={CheckCircle} color="green" />
        <StatCard label={t('material.receive.stats.todayReceivedQty')} value={stats.todayReceivedQty} icon={Hash} color="purple" />
      </div>

      {/* 입고대기 테이블 */}
      <Card>
        <CardContent>
          <ReceivableTable
            data={filtered}
            inputs={inputs}
            onInputChange={handleInputChange}
            onSelectAll={handleSelectAll}
            allSelected={allSelected}
            isLoading={loading}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder={t('material.receive.searchPlaceholder')}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                    fullWidth
                  />
                </div>
                <Button variant="secondary" onClick={refresh} className="flex-shrink-0">
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
