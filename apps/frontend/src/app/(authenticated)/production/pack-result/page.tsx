"use client";

/**
 * @file src/app/(authenticated)/production/pack-result/page.tsx
 * @description 포장실적조회 페이지 - BoxMaster 조회 전용
 *
 * 초보자 가이드:
 * 1. **목적**: 포장 완료된 박스 실적을 조회
 * 2. **BoxMaster**: 박스번호, LOT번호, 포장수량 등 관리
 * 3. API: GET /production/pack-results
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, BoxIcon } from 'lucide-react';
import { Card, CardContent, Button, Input } from '@/components/ui';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import DataGrid from '@/components/data-grid/DataGrid';
import api from '@/services/api';
import { createPackResultGridColumns } from './packResultColumns';
import type { PackResult } from './types';

/** 로컬 타임존 기준 오늘 날짜(YYYY-MM-DD) */
const getTodayStr = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export default function PackResultPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<PackResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [fromDate, setStartDate] = useState(getTodayStr);
  const [toDate, setEndDate] = useState(getTodayStr);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '5000' };
      if (searchText) params.search = searchText;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const res = await api.get('/production/pack-result', { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = useMemo(() => createPackResultGridColumns(t), [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><BoxIcon className="w-7 h-7 text-primary" />{t('production.packResult.title')}</h1>
          <p className="text-text-muted mt-1">{t('production.packResult.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />{t('common.refresh')}
          </Button>
        </div>
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t('production.packResult.title')}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t('production.packResult.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <DateRangeFilter from={fromDate} to={toDate} onFromChange={setStartDate} onToChange={setEndDate} className="flex-shrink-0" />
            </div>
          } 
          sqlQuery={`SELECT *\nFROM PACK_RESULTS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>
    </div>
  );
}
