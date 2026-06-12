"use client";

/**
 * @file src/app/(authenticated)/material/receive/page.tsx
 * @description 자재입고관리 페이지 - IQC 합격건 스캔 방식 입고 등록
 *
 * 초보자 가이드:
 * 1. 입고대기 그리드는 입고 대상 확인용이다.
 * 2. 입고처리 버튼을 누른 뒤 거래처 바코드와 자체부착 바코드를 순환 스캔한다.
 * 3. 스캔된 매핑만 입고 확정된다.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PackagePlus, RefreshCw, ScanLine, Search } from 'lucide-react';
import { Card, CardContent, Button, Input, Select } from '@/components/ui';
import api from '@/services/api';
import ReceivableTable from './components/ReceivableTable';
import ReceiveScanModal from './components/ReceiveScanModal';
import type { ReceivableLot } from './components/types';

export default function ReceivingPage() {
  const { t } = useTranslation();

  const [receivable, setReceivable] = useState<ReceivableLot[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  /** 필터 상태 — 날짜 기본값: 당일 */
  const today = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [vendorFilter, setVendorFilter] = useState('');
  const [itemSearch, setItemSearch] = useState('');

  /** 입고 가능 LOT 조회 */
  const fetchReceivable = useCallback(async () => {
    try {
      const res = await api.get('/material/receiving/receivable');
      const lots: ReceivableLot[] = res.data.data || [];
      setReceivable(lots);
    } catch { setReceivable([]); }
  }, []);

  /** 전체 새로고침 */
  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchReceivable();
    setLoading(false);
  }, [fetchReceivable]);

  useEffect(() => { refresh(); }, [refresh]);

  /** 공급업체 옵션 (데이터에서 distinct) */
  const vendorOptions = useMemo(() => {
    const set = new Set<string>();
    receivable.forEach((lot) => { if (lot.vendor) set.add(lot.vendor); });
    return [
      { value: '', label: `${t('material.arrival.col.vendor', '공급업체')}: ${t('common.all', '전체')}` },
      ...[...set].sort().map((v) => ({ value: v, label: v })),
    ];
  }, [receivable, t]);

  /** 필터링 */
  const filtered = useMemo(() => {
    return receivable.filter((lot) => {
      const recvDay = lot.recvDate ? String(lot.recvDate).slice(0, 10) : '';
      if (fromDate && recvDay && recvDay < fromDate) return false;
      if (toDate && recvDay && recvDay > toDate) return false;
      if (vendorFilter && lot.vendor !== vendorFilter) return false;
      if (itemSearch) {
        const q = itemSearch.toLowerCase();
        if (
          !lot.part?.itemCode?.toLowerCase().includes(q) &&
          !lot.part?.itemName?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [receivable, fromDate, toDate, vendorFilter, itemSearch]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <PackagePlus className="w-7 h-7 text-primary" />
            {t('material.receive.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('material.receive.description')}</p>
        </div>
        <Button size="sm" onClick={() => setScanOpen(true)}>
          <ScanLine className="w-4 h-4 mr-1" />
          입고처리
        </Button>
      </div>

      {/* 입고대기 테이블 */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
          <ReceivableTable
            data={filtered}
            isLoading={loading}
            toolbarLeft={
              <div className="flex gap-2 flex-1 min-w-0 items-center flex-wrap">
                {/* 날짜 범위 */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-36"
                  />
                  <span className="text-text-muted text-sm">~</span>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-36"
                  />
                </div>
                {/* 공급업체 */}
                <div className="w-44 flex-shrink-0">
                  <Select options={vendorOptions} value={vendorFilter} onChange={setVendorFilter} fullWidth />
                </div>
                {/* 품목 */}
                <div className="w-48 flex-shrink-0">
                  <Input
                    placeholder={t('material.receiveHistory.itemPlaceholder', '품번/품명')}
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
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

      <ReceiveScanModal
        isOpen={scanOpen}
        onClose={() => setScanOpen(false)}
        onSuccess={refresh}
        receivable={receivable}
      />
    </div>
  );
}
