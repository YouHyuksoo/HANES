"use client";

/**
 * @file src/app/(authenticated)/production/wip-material-trans/page.tsx
 * @description 공정 수불(WIP_MAT_TRANSACTIONS) 거래원장 조회 화면
 *
 * 초보자 가이드:
 * 1. **목적**: 설비(EQUIP_CODE) 단위 공정재고의 입고/소비/취소 거래 이력 조회.
 *    (원자재 수불 STOCK_TRANSACTIONS와 완전 분리된 공정 전용 원장)
 * 2. API: GET /inventory/wip-mat-transactions?equipCode=&transType=&search=&fromDate=&toDate=
 * 3. 거래유형: WIP_IN(공정입고), WIP_IN_CANCEL(공정입고취소),
 *             PROD_CONSUME(생산소비), PROD_CONSUME_CANCEL(생산소비취소)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { History, RefreshCw, Search } from 'lucide-react';
import { Card, CardContent, Button, Input, Select } from '@/components/ui';
import EquipSelect from '@/components/shared/EquipSelect';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import DataGrid from '@/components/data-grid/DataGrid';
import api from '@/services/api';
import { getTodayLocal } from '@/utils/date';
import { createWipMaterialTransGridColumns, WipMatTransactionRow } from './wipMaterialTransColumns';

/** 오늘 날짜를 YYYY-MM-DD 형식으로 반환 */
const getToday = () => getTodayLocal();

export default function WipMaterialTransPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<WipMatTransactionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [equipCode, setEquipCode] = useState('');
  const [filters, setFilters] = useState({
    transType: '',
    fromDate: getToday(),
    toDate: getToday(),
  });

  const TRANS_TYPES = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'WIP_IN', label: t('production.wipMaterialTrans.typeWipIn') },
    { value: 'WIP_IN_CANCEL', label: t('production.wipMaterialTrans.typeWipInCancel') },
    { value: 'PROD_CONSUME', label: t('production.wipMaterialTrans.typeProdConsume') },
    { value: 'PROD_CONSUME_CANCEL', label: t('production.wipMaterialTrans.typeProdConsumeCancel') },
  ], [t]);

  const getTransTypeLabel = useCallback(
    (type: string) => TRANS_TYPES.find((tt) => tt.value === type)?.label || type,
    [TRANS_TYPES],
  );

  const fetchData = useCallback(async () => {
    if (!filters.fromDate || !filters.toDate) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {
        fromDate: filters.fromDate,
        toDate: filters.toDate,
      };
      if (filters.transType) params.transType = filters.transType;
      if (equipCode) params.equipCode = equipCode;
      if (searchText) params.search = searchText;
      const res = await api.get('/inventory/wip-mat-transactions', { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [filters, equipCode, searchText]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = useMemo(
    () => createWipMaterialTransGridColumns({ t, getTransTypeLabel }),
    [t, getTransTypeLabel],
  );

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <History className="w-7 h-7 text-primary" />{t('production.wipMaterialTrans.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('production.wipMaterialTrans.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />{t('common.refresh')}
          </Button>
        </div>
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          emptyMessage={t('production.wipMaterialTrans.emptyMessage')}
          enableColumnFilter
          enableExport
          exportFileName={t('production.wipMaterialTrans.title')}
          toolbarLeft={
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <DateRangeFilter from={filters.fromDate} to={filters.toDate} onFromChange={(v) => setFilters(f => ({ ...f, fromDate: v }))} onToChange={(v) => setFilters(f => ({ ...f, toDate: v }))} className="flex-shrink-0" />
              <div className="w-48 flex-shrink-0">
                <EquipSelect value={equipCode} onChange={setEquipCode} labelPrefix={t('production.wipMaterialTrans.equip')} fullWidth />
              </div>
              <div className="w-40 flex-shrink-0">
                <Select options={TRANS_TYPES} value={filters.transType} onChange={(v) => setFilters({ ...filters, transType: v })} placeholder={t('production.wipMaterialTrans.transType')} />
              </div>
              <div className="flex-1 min-w-0">
                <Input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder={t('production.wipMaterialTrans.searchPlaceholder')} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
            </div>
          }
          sqlQuery={`SELECT tx.TRANS_NO, tx.TRANS_TYPE, tx.EQUIP_CODE, e.EQUIP_NAME,\n       tx.ITEM_CODE, i.ITEM_NAME, tx.MAT_UID, tx.QTY,\n       tx.REF_TYPE, tx.REF_ID, tx.STATUS, tx.REMARK, tx.CREATED_AT\nFROM WIP_MAT_TRANSACTIONS tx\nLEFT JOIN EQUIP_MASTERS e ON e.EQUIP_CODE = tx.EQUIP_CODE\nLEFT JOIN ITEM_MASTERS i ON i.ITEM_CODE = tx.ITEM_CODE\nWHERE tx.COMPANY = '40'\n  AND tx.PLANT_CD = '1000'\nORDER BY tx.CREATED_AT DESC`}
        />
      </CardContent></Card>
    </div>
  );
}
