"use client";

/**
 * @file src/app/(authenticated)/production/progress/page.tsx
 * @description 작업지시 진행현황 대시보드 - 계획수량 vs 실적수량, 진행률, 상태별 현황
 *
 * 초보자 가이드:
 * 1. **목적**: 현재 작업지시들의 진행 상태를 한눈에 파악
 * 2. **StatCard**: 상태별 건수 요약 (대기/진행/완료/전체)
 * 3. API: GET /production/job-orders
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, BarChart3 } from 'lucide-react';
import { Card, CardContent, Button, Input, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { useComCodeOptions } from '@/hooks/useComCode';
import { MultiSelectFilter } from '@/components/shared';
import { useEquipOptions } from '@/hooks/useMasterOptions';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import api from '@/services/api';
import { getTodayLocal } from '@/utils/date';
import { createProgressGridColumns } from './progressColumns';
import type { ProgressItem } from './types';

/** 오늘 날짜를 YYYY-MM-DD 형식으로 반환 */
const getToday = () => getTodayLocal();

/**
 * 설비 필터의 "미착수" 선택값 — 백엔드 job-order.service.ts의 JOB_ORDER_UNASSIGNED_EQUIP와 동일 문자열.
 * 이 화면의 설비 필터는 생산실적 기준(EXISTS PROD_RESULTS)이라, 실적이 아직 없는 작업지시는 실제 설비를
 * 아무리 골라도 걸리지 않는다. "전체 선택"이 실제 전체가 되려면 미착수를 선택지로 둬야 한다.
 */
const EQUIP_UNASSIGNED = '__UNASSIGNED__';

export default function ProgressPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ProgressItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [equipFilter, setEquipFilter] = useState<string[]>([]);
  const { options: rawEquipOptions } = useEquipOptions(undefined, { includeInactive: true });
  const equipOptions = useMemo(
    () => [{ value: EQUIP_UNASSIGNED, label: t('production.progress.equipUnassigned', '미착수') }, ...rawEquipOptions],
    [rawEquipOptions, t],
  );
  const [shiftFilter, setShiftFilter] = useState('');
  const [shiftOptions, setShiftOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [planDateFrom, setPlanDateFrom] = useState(getToday());
  const [planDateTo, setPlanDateTo] = useState(getToday());

  /** 교대 옵션 조회 */
  useEffect(() => {
    api.get('/master/shift-patterns').then((res) => {
      const patterns = res.data?.data ?? [];
      setShiftOptions(patterns.map((p: { shiftCode: string; shiftName: string; startTime: string; endTime: string }) => ({
        value: p.shiftCode,
        label: `${p.shiftName} (${p.startTime}~${p.endTime})`,
      })));
    }).catch(() => { /* 교대 마스터 미등록 시 무시 */ });
  }, []);

  const comCodeStatusOptions = useComCodeOptions('JOB_ORDER_STATUS');
  const statusOptions = useMemo(() => [
    { value: '', label: t('common.allStatus') }, ...comCodeStatusOptions
  ], [t, comCodeStatusOptions]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '5000' };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      if (equipFilter.length > 0) params.equipCode = equipFilter.join(',');
      if (shiftFilter) params.shift = shiftFilter;
      if (planDateFrom) params.planDateFrom = planDateFrom;
      if (planDateTo) params.planDateTo = planDateTo;
      const res = await api.get('/production/job-orders', { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, equipFilter, shiftFilter, planDateFrom, planDateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = useMemo(() => createProgressGridColumns(t), [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" />{t('production.progress.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('production.progress.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />{t('common.refresh')}
          </Button>
        </div>
      </div>
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t('production.progress.title')}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t('production.progress.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <DateRangeFilter from={planDateFrom} to={planDateTo} onFromChange={setPlanDateFrom} onToChange={setPlanDateTo} className="flex-shrink-0" />
              <div className="w-36 flex-shrink-0">
                <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth />
              </div>
              <div className="w-48 flex-shrink-0">
                <MultiSelectFilter options={equipOptions} value={equipFilter} onChange={setEquipFilter}
                  labelPrefix={t('production.order.equip', '설비')} fullWidth />
              </div>
              <div className="w-44 flex-shrink-0">
                <Select options={[{ value: '', label: t('common.all') }, ...shiftOptions]} value={shiftFilter} onChange={setShiftFilter} fullWidth />
              </div>
            </div>
          } 
          sqlQuery={`SELECT *\nFROM PROD_PROGRESS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>
    </div>
  );
}
