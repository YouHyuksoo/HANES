"use client";

/**
 * @file src/pages/inventory/InventoryStockPage.tsx
 * @description 제품재고 현황 페이지 - 제품(WIP/FG) 창고별 재고 조회
 *
 * 초보자 가이드:
 * 1. 제품재고관리 메뉴에서 접근하는 페이지
 * 2. 원자재(RAW)는 제외하고 반제품(WIP)/완제품(FG)만 표시
 * 3. 창고유형/품목유형 필터로 조건 검색 가능
 */
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, RefreshCw, Search, CheckCircle, Layers, Hash } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { api } from '@/services/api';
import { createStockGridColumns, type StockData } from './stockColumns';

export default function InventoryStockPage() {
  const { t } = useTranslation();
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(false);

  const WAREHOUSE_TYPES = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'WIP', label: t('inventory.stock.wip') },
    { value: 'FG', label: t('inventory.stock.fg') },
    { value: 'FLOOR', label: t('inventory.stock.floor') },
    { value: 'DEFECT', label: t('inventory.stock.defect') },
    { value: 'SCRAP', label: t('inventory.stock.scrap') },
  ], [t]);

  const PART_TYPES = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'SEMI_PRODUCT', label: t('inventory.stock.wip') },
    { value: 'FINISHED', label: t('inventory.stock.fg') },
  ], [t]);

  // 필터
  const [filters, setFilters] = useState({
    warehouseType: '',
    itemType: '',
    itemCode: '',
    includeZero: false,
  });

  const fetchStocks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.warehouseType) params.append('warehouseType', filters.warehouseType);
      if (filters.itemType) params.append('itemType', filters.itemType);
      if (filters.includeZero) params.append('includeZero', 'true');

      const res = await api.get(`/inventory/stocks?${params.toString()}`);
      const result = res.data?.data ?? res.data;
      setStocks(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('재고 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStocks();
  }, []);

  // 필터링된 데이터 (제품재고만: RAW 제외)
  const filteredStocks = useMemo(() => {
    return stocks.filter(stock => {
      if (stock.part?.itemType === 'RAW_MATERIAL') return false;
      if (stock.warehouse?.warehouseType === 'RAW') return false;
      if (filters.itemCode && !stock.part.itemCode.includes(filters.itemCode)) return false;
      return true;
    });
  }, [stocks, filters.itemCode]);

  const columns = useMemo(() => createStockGridColumns({ t }), [t]);

  // 통계 계산 (필터링된 제품재고 기준)
  const totalStock = filteredStocks.reduce((sum, s) => sum + s.qty, 0);
  const totalAvailable = filteredStocks.reduce((sum, s) => sum + s.availableQty, 0);
  const partCount = new Set(filteredStocks.map(s => s.itemCode)).size;
  const lotCount = filteredStocks.length;

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Package className="w-7 h-7 text-primary" />{t('inventory.stock.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('inventory.stock.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchStocks}><RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t('common.refresh')}</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        <StatCard label={t('inventory.stock.totalStock')} value={totalStock} icon={Package} color="blue" />
        <StatCard label={t('inventory.stock.availableStock')} value={totalAvailable} icon={CheckCircle} color="green" />
        <StatCard label={t('inventory.stock.partCount')} value={partCount} icon={Layers} color="purple" />
        <StatCard label={t('inventory.stock.lotCount')} value={lotCount} icon={Hash} color="orange" />
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid
            data={filteredStocks}
            columns={columns}
            isLoading={loading}
            emptyMessage={t('inventory.stock.emptyMessage')}
            enableColumnFilter
            enableExport
            exportFileName={t('inventory.stock.title')}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t('inventory.stock.searchPartCode')} value={filters.itemCode} onChange={(e) => setFilters({ ...filters, itemCode: e.target.value })} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <Select options={WAREHOUSE_TYPES} value={filters.warehouseType} onChange={(v) => setFilters({ ...filters, warehouseType: v })} placeholder={t('inventory.stock.warehouseType')} />
                <Select options={PART_TYPES} value={filters.itemType} onChange={(v) => setFilters({ ...filters, itemType: v })} placeholder={t('inventory.stock.partType')} />
                <div className="flex items-center gap-2 flex-shrink-0">
                  <input type="checkbox" id="includeZero" checked={filters.includeZero} onChange={(e) => setFilters({ ...filters, includeZero: e.target.checked })} />
                  <label htmlFor="includeZero" className="text-sm text-text-muted">{t('common.includeZero')}</label>
                </div>
              </div>
            }
          
          sqlQuery={`SELECT *\nFROM FG_STOCKS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>
    </div>
  );
}
