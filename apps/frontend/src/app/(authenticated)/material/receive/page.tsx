"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PackagePlus, RefreshCw, Search } from 'lucide-react';
import { Button, Card, CardContent, Input, Select } from '@/components/ui';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import api from '@/services/api';
import { getTodayLocal } from '@/utils/date';
import ReceivableTable from './components/ReceivableTable';
import ReceiveScanPanel from './components/ReceiveScanPanel';
import type { ReceivableLot } from './components/types';

export default function ReceivingPage() {
  const { t } = useTranslation();

  const [receivable, setReceivable] = useState<ReceivableLot[]>([]);
  const [loading, setLoading] = useState(false);

  const today = getTodayLocal();
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [vendorFilter, setVendorFilter] = useState('');
  const [itemSearch, setItemSearch] = useState('');

  const fetchReceivable = useCallback(async () => {
    try {
      const res = await api.get('/material/receiving/receivable');
      setReceivable(res.data.data || []);
    } catch { setReceivable([]); }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchReceivable();
    setLoading(false);
  }, [fetchReceivable]);

  useEffect(() => { refresh(); }, [refresh]);

  const vendorOptions = useMemo(() => {
    const set = new Set<string>();
    receivable.forEach((lot) => { if (lot.vendor) set.add(lot.vendor); });
    return [
      { value: '', label: `${t('material.arrival.col.vendor', '공급업체')}: ${t('common.all', '전체')}` },
      ...[...set].sort().map((v) => ({ value: v, label: v })),
    ];
  }, [receivable, t]);

  const filtered = useMemo(() => receivable.filter((lot) => {
    const recvDay = lot.recvDate ? String(lot.recvDate).slice(0, 10) : '';
    if (fromDate && recvDay && recvDay < fromDate) return false;
    if (toDate && recvDay && recvDay > toDate) return false;
    if (vendorFilter && lot.vendor !== vendorFilter) return false;
    if (itemSearch) {
      const q = itemSearch.toLowerCase();
      if (!lot.part?.itemCode?.toLowerCase().includes(q) && !lot.part?.itemName?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [receivable, fromDate, toDate, vendorFilter, itemSearch]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex-shrink-0 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <PackagePlus className="w-7 h-7 text-primary" />
            {t('material.receive.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('material.receive.description')}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </Button>
      </div>

      {/* 본문: 좌측 입고대기 + 우측 스캔패널 */}
      <div className="flex-1 min-h-0 flex gap-3">
        {/* 좌측: 입고대기 목록 */}
        <Card className="flex-1 min-w-0 flex flex-col overflow-hidden" padding="none">
          <CardContent className="h-full p-3">
            <ReceivableTable
              data={filtered}
              isLoading={loading}
              toolbarLeft={
                <div className="flex gap-2 flex-1 min-w-0 items-center flex-wrap">
                  <DateRangeFilter
                    from={fromDate}
                    to={toDate}
                    onFromChange={setFromDate}
                    onToChange={setToDate}
                    className="flex-shrink-0"
                  />
                  <div className="w-40 flex-shrink-0">
                    <Select options={vendorOptions} value={vendorFilter} onChange={setVendorFilter} fullWidth />
                  </div>
                  <div className="w-44 flex-shrink-0">
                    <Input
                      placeholder={t('material.receiveHistory.itemPlaceholder', '품번/품명')}
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      leftIcon={<Search className="w-4 h-4" />}
                      fullWidth
                    />
                  </div>
                </div>
              }
            />
          </CardContent>
        </Card>

        {/* 우측: 스캔 입고 패널 */}
        <Card className="w-[340px] flex-shrink-0 flex flex-col overflow-hidden" padding="none">
          <ReceiveScanPanel receivable={receivable} onSuccess={refresh} />
        </Card>
      </div>
    </div>
  );
}
