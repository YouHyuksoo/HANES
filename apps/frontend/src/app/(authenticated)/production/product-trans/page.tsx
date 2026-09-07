"use client";

/**
 * @file src/app/(authenticated)/production/product-trans/page.tsx
 * @description 반제품/제품 수불(PRODUCT_TRANSACTIONS) 거래원장 조회 화면
 *
 * 초보자 가이드:
 * 1. **목적**: 반제품(SEMI_PRODUCT)/완제품(FINISHED) WIP 재고의 입고/출고/취소 거래 이력 조회.
 *    (원자재공정수불 WIP_MAT_TRANSACTIONS와 완전 분리된 제품 전용 원장)
 * 2. API: GET /inventory/product/transactions?warehouseId=&itemCode=&itemType=&qualityStatus=&transType=&fromDate=&toDate=
 * 3. 거래유형: WIP_IN/WIP_IN_CANCEL(반제품입고/취소), WIP_OUT/WIP_OUT_CANCEL(반제품출고/취소),
 *             FG_IN/FG_IN_CANCEL(제품입고/취소), FG_OUT/FG_OUT_CANCEL(제품출고/취소), DEFECT_IN(불량입고)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { History, RefreshCw, Search, X } from 'lucide-react';
import { Card, CardContent, Button, Select, Input } from '@/components/ui';
import WarehouseSelect from '@/components/shared/WarehouseSelect';
import PartSearchModal, { type PartItem } from '@/components/shared/PartSearchModal';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import DataGrid from '@/components/data-grid/DataGrid';
import api from '@/services/api';
import { getTodayLocal } from '@/utils/date';
import { createProductTransGridColumns, ProductTransactionRow } from './productTransColumns';

const getToday = () => getTodayLocal();

export default function ProductTransPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ProductTransactionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [partModalOpen, setPartModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    itemType: '',
    qualityStatus: '',
    transType: '',
    fromDate: getToday(),
    toDate: getToday(),
  });

  const ITEM_TYPES = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'SEMI_PRODUCT', label: t('production.productTrans.itemTypeSemi') },
    { value: 'FINISHED', label: t('production.productTrans.itemTypeFinished') },
  ], [t]);

  const QUALITY_STATUSES = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'GOOD', label: t('production.productTrans.qualityGood') },
    { value: 'DEFECT', label: t('production.productTrans.qualityDefect') },
  ], [t]);

  const TRANS_TYPES = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'WIP_IN', label: t('production.productTrans.typeWipIn') },
    { value: 'WIP_IN_CANCEL', label: t('production.productTrans.typeWipInCancel') },
    { value: 'WIP_OUT', label: t('production.productTrans.typeWipOut') },
    { value: 'WIP_OUT_CANCEL', label: t('production.productTrans.typeWipOutCancel') },
    { value: 'FG_IN', label: t('production.productTrans.typeFgIn') },
    { value: 'FG_IN_CANCEL', label: t('production.productTrans.typeFgInCancel') },
    { value: 'FG_OUT', label: t('production.productTrans.typeFgOut') },
    { value: 'FG_OUT_CANCEL', label: t('production.productTrans.typeFgOutCancel') },
    { value: 'DEFECT_IN', label: t('production.productTrans.typeDefectIn') },
  ], [t]);

  const getTransTypeLabel = useCallback(
    (type: string) => TRANS_TYPES.find((tt) => tt.value === type)?.label || type,
    [TRANS_TYPES],
  );
  const getItemTypeLabel = useCallback(
    (type: string | null) => ITEM_TYPES.find((it) => it.value === type)?.label || type || '-',
    [ITEM_TYPES],
  );
  const getQualityLabel = useCallback(
    (status: string) => QUALITY_STATUSES.find((qs) => qs.value === status)?.label || status,
    [QUALITY_STATUSES],
  );

  const handleSelectPart = useCallback((part: PartItem) => {
    setItemCode(part.itemCode);
    setItemName(part.itemName);
    setPartModalOpen(false);
  }, []);

  const handleClearPart = useCallback(() => {
    setItemCode('');
    setItemName('');
  }, []);

  const fetchData = useCallback(async () => {
    if (!filters.fromDate || !filters.toDate) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {
        fromDate: filters.fromDate,
        toDate: filters.toDate,
      };
      if (filters.itemType) params.itemType = filters.itemType;
      if (filters.qualityStatus) params.qualityStatus = filters.qualityStatus;
      if (filters.transType) params.transType = filters.transType;
      if (warehouseId) params.warehouseId = warehouseId;
      if (itemCode) params.itemCode = itemCode;
      const res = await api.get('/inventory/product/transactions', { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [filters, warehouseId, itemCode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = useMemo(
    () => createProductTransGridColumns({ t, getTransTypeLabel, getItemTypeLabel, getQualityLabel }),
    [t, getTransTypeLabel, getItemTypeLabel, getQualityLabel],
  );

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <History className="w-7 h-7 text-primary" />{t('production.productTrans.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('production.productTrans.description')}</p>
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
          emptyMessage={t('production.productTrans.emptyMessage')}
          enableColumnFilter
          enableExport
          exportFileName={t('production.productTrans.title')}
          toolbarLeft={
            <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
              <DateRangeFilter from={filters.fromDate} to={filters.toDate} onFromChange={(v) => setFilters(f => ({ ...f, fromDate: v }))} onToChange={(v) => setFilters(f => ({ ...f, toDate: v }))} className="flex-shrink-0" />
              <div className="w-48 flex-shrink-0">
                <WarehouseSelect includeAll labelPrefix={t('production.productTrans.warehouse')} value={warehouseId} onChange={setWarehouseId} fullWidth />
              </div>
              <div className="w-56 flex-shrink-0 flex gap-1">
                <div className="flex-1 cursor-pointer" onClick={() => setPartModalOpen(true)}>
                  <Input
                    value={itemCode ? `${itemCode} - ${itemName}` : ''}
                    placeholder={t('production.productTrans.itemCode')}
                    readOnly
                    fullWidth
                    className="cursor-pointer"
                    rightIcon={<Search className="w-4 h-4" />}
                  />
                </div>
                {itemCode && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleClearPart}
                    aria-label={t('common.clear', '지우기')}
                    title={t('common.clear', '지우기')}
                    className="flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <div className="w-36 flex-shrink-0">
                <Select options={ITEM_TYPES} value={filters.itemType} onChange={(v) => setFilters({ ...filters, itemType: v })} placeholder={t('production.productTrans.itemType')} />
              </div>
              <div className="w-32 flex-shrink-0">
                <Select options={QUALITY_STATUSES} value={filters.qualityStatus} onChange={(v) => setFilters({ ...filters, qualityStatus: v })} placeholder={t('production.productTrans.qualityStatus')} />
              </div>
              <div className="w-44 flex-shrink-0">
                <Select options={TRANS_TYPES} value={filters.transType} onChange={(v) => setFilters({ ...filters, transType: v })} placeholder={t('production.productTrans.transType')} />
              </div>
            </div>
          }
          sqlQuery={`SELECT tx.TRANS_NO, tx.TRANS_TYPE, tx.TRANS_DATE, tx.ITEM_CODE, i.ITEM_NAME,\n       tx.ITEM_TYPE, tx.QUALITY_STATUS, tx.QTY,\n       fw.WAREHOUSE_NAME AS FROM_WAREHOUSE, tw.WAREHOUSE_NAME AS TO_WAREHOUSE,\n       tx.ORDER_NO, tx.PROCESS_CODE, tx.REF_TYPE, tx.REF_ID, tx.WORKER_CODE, tx.REMARK\nFROM PRODUCT_TRANSACTIONS tx\nLEFT JOIN ITEM_MASTERS i ON i.ITEM_CODE = tx.ITEM_CODE\nLEFT JOIN WAREHOUSES fw ON fw.WAREHOUSE_CODE = tx.FROM_WAREHOUSE_ID\nLEFT JOIN WAREHOUSES tw ON tw.WAREHOUSE_CODE = tx.TO_WAREHOUSE_ID\nWHERE tx.COMPANY = '40'\n  AND tx.PLANT_CD = '1000'\nORDER BY tx.TRANS_DATE DESC`}
        />
      </CardContent></Card>

      <PartSearchModal
        isOpen={partModalOpen}
        onClose={() => setPartModalOpen(false)}
        onSelect={handleSelectPart}
        allowedItemTypes={['SEMI_PRODUCT', 'FINISHED']}
      />
    </div>
  );
}
