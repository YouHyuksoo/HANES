"use client";

/**
 * @file src/app/(authenticated)/material/receive-history/page.tsx
 * @description 입고이력조회 페이지 - MAT_RECEIVINGS 기반 입고 이력 조회
 *
 * 초보자 가이드:
 * 1. RECEIVE 타입 StockTransaction 이력을 표시하는 조회 전용 페이지
 * 2. 입고번호, 입고일, LOT번호, 품목, 수량, 창고 등 표시
 * 3. 상단 필터(일자/품목/자재 시리얼)는 서버사이드로 조회한다
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, RefreshCw, Search } from 'lucide-react';
import { Button, Input, Select, Card, CardContent } from '@/components/ui';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import FilterBar from '@/components/shared/FilterBar';
import api from '@/services/api';
import { getTodayLocal } from '@/utils/date';
import ReceivingHistoryTable from '../receive/components/ReceivingHistoryTable';
import type { ReceivingRecord } from '../receive/components/types';

export default function ReceiveHistoryPage() {
  const { t } = useTranslation();

  const [history, setHistory] = useState<ReceivingRecord[]>([]);
  const [loading, setLoading] = useState(false);

  /** 필터 상태 — 날짜 기본값: 당일 */
  const today = getTodayLocal();
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [itemSearch, setItemSearch] = useState('');
  const [serial, setSerial] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');

  /** 입고 이력 조회 */
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: 1, limit: 200 };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (itemSearch.trim()) params.search = itemSearch.trim();
      if (serial.trim()) params.matUid = serial.trim();
      const res = await api.get('/material/receiving', { params });
      setHistory(res.data.data || []);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, itemSearch, serial]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  /** 공급사 옵션 (로드된 이력의 distinct 공급처) */
  const vendorOptions = useMemo(() => {
    const set = new Set<string>();
    history.forEach((h) => { if (h.vendor) set.add(h.vendor); });
    return [
      { value: '', label: `${t('material.col.supplier', '공급처')}: ${t('common.all')}` },
      ...[...set].sort().map((v) => ({ value: v, label: v })),
    ];
  }, [history, t]);

  /** 공급사 필터 적용 (client-side) */
  const filteredHistory = useMemo(
    () => (vendorFilter ? history.filter((h) => h.vendor === vendorFilter) : history),
    [history, vendorFilter],
  );

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            {t('material.receiveHistory.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('material.receiveHistory.description')}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchHistory}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> {t('common.refresh')}
        </Button>
      </div>

      {/* 이력 테이블 */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
          <ReceivingHistoryTable
            data={filteredHistory}
            isLoading={loading}
            toolbarLeft={
              <FilterBar>
                <DateRangeFilter
                  from={fromDate}
                  to={toDate}
                  onFromChange={setFromDate}
                  onToChange={setToDate}
                  className="flex-shrink-0"
                />
                <div className="w-44 flex-shrink-0">
                  <Select options={vendorOptions} value={vendorFilter} onChange={setVendorFilter} fullWidth />
                </div>
                <div className="w-48 min-w-0 flex-shrink-0">
                  <Input
                    placeholder={t('material.receiveHistory.itemPlaceholder')}
                    value={itemSearch}
                    onChange={e => setItemSearch(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                    fullWidth
                  />
                </div>
                <div className="w-48 min-w-0 flex-shrink-0">
                  <Input
                    placeholder={t('material.receiveHistory.serialPlaceholder')}
                    value={serial}
                    onChange={e => setSerial(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                    fullWidth
                  />
                </div>
              </FilterBar>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
