"use client";

/**
 * @file src/app/(authenticated)/production/wip-material-trans/page.tsx
 * @description 공정 수불(WIP_MAT_TRANSACTIONS) 거래원장 조회 화면
 *
 * 초보자 가이드:
 * 1. **목적**: 설비(EQUIP_CODE) 단위 공정재고의 입고/소비/취소 거래 이력 조회.
 *    (원자재 수불 STOCK_TRANSACTIONS와 완전 분리된 공정 전용 원장)
 * 2. API: GET /inventory/wip-mat-transactions?equipCode=&transType=&search=&dateFrom=&dateTo=
 * 3. 거래유형: WIP_IN(공정입고), WIP_IN_CANCEL(공정입고취소),
 *             PROD_CONSUME(생산소비), PROD_CONSUME_CANCEL(생산소비취소)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { History, RefreshCw, Search, Calendar } from 'lucide-react';
import { Card, CardContent, Button, Input, Select } from '@/components/ui';
import EquipSelect from '@/components/shared/EquipSelect';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/services/api';

interface WipMatTransactionRow {
  transNo: string;
  transType: string;
  equipCode: string;
  equipName: string | null;
  itemCode: string;
  itemName: string | null;
  matUid: string;
  qty: number;
  fromWarehouseId: string | null;
  orderNo: string | null;
  refType: string | null;
  refId: string | null;
  cancelRefId: string | null;
  status: string;
  remark: string | null;
  workerId: string | null;
  createdAt: string | null;
}

/** 거래유형 색상: +수량=입고계열(blue), 소비=주황, 취소=빨강 */
const getTransTypeColor = (type: string) => {
  if (type.endsWith('_CANCEL')) return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  if (type === 'WIP_IN') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
  if (type === 'PROD_CONSUME') return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300';
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300';
};

/** 오늘 날짜를 YYYY-MM-DD 형식으로 반환 */
const getToday = () => new Date().toISOString().slice(0, 10);

export default function WipMaterialTransPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<WipMatTransactionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [equipCode, setEquipCode] = useState('');
  const [filters, setFilters] = useState({
    transType: '',
    dateFrom: getToday(),
    dateTo: getToday(),
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
    if (!filters.dateFrom || !filters.dateTo) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
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

  const columns = useMemo<ColumnDef<WipMatTransactionRow>[]>(() => [
    {
      accessorKey: 'createdAt', header: t('production.wipMaterialTrans.transDate'), size: 160,
      meta: { filterType: 'date' as const },
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? new Date(v).toLocaleString() : '-';
      },
    },
    {
      accessorKey: 'transType', header: t('production.wipMaterialTrans.transType'), size: 130,
      meta: { filterType: 'multi' as const },
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${getTransTypeColor(row.original.transType)}`}>
          {getTransTypeLabel(row.original.transType)}
        </span>
      ),
    },
    {
      accessorKey: 'equipName', header: t('production.wipMaterialTrans.equip'), size: 150,
      meta: { filterType: 'text' as const },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.equipName ?? '-'}</span>
          <span className="font-mono text-xs text-text-muted">{row.original.equipCode}</span>
        </div>
      ),
    },
    {
      accessorKey: 'itemCode', header: t('production.wipMaterialTrans.item'), size: 160,
      meta: { filterType: 'text' as const },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-mono text-sm">{row.original.itemCode}</span>
          <span className="text-xs text-text-muted">{row.original.itemName ?? '-'}</span>
        </div>
      ),
    },
    {
      accessorKey: 'matUid', header: t('production.wipMaterialTrans.lot'), size: 160,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || '-'}</span>,
    },
    {
      accessorKey: 'qty', header: t('production.wipMaterialTrans.qty'), size: 100,
      meta: { filterType: 'number' as const },
      cell: ({ row }) => (
        <span className={row.original.qty < 0 ? 'text-red-600 font-semibold text-right block' : 'text-blue-600 font-semibold text-right block'}>
          {row.original.qty > 0 ? '+' : ''}{(row.original.qty ?? 0).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: 'refType', header: t('production.wipMaterialTrans.ref'), size: 180,
      meta: { filterType: 'text' as const },
      cell: ({ row }) => {
        const { refType, refId } = row.original;
        if (!refType && !refId) return '-';
        return (
          <div className="flex flex-col">
            <span className="text-xs text-text-muted">{refType ?? '-'}</span>
            <span className="font-mono text-xs">{refId ?? '-'}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'remark', header: t('production.wipMaterialTrans.remark'), size: 150,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => (getValue() as string) || '-',
    },
  ], [t, getTransTypeLabel]);

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
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Calendar className="w-4 h-4 text-text-muted" />
                <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className="w-36" />
                <span className="text-text-muted">~</span>
                <Input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className="w-36" />
              </div>
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
