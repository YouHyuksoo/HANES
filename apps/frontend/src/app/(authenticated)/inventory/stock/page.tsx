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
import { ColumnDef, CellContext } from '@tanstack/react-table';
import { api } from '@/services/api';
import {
  createPartColumns,
  createWarehouseColumns,
  createQtyColumn,
  createDateColumn,
} from '@/lib/table-utils';

interface StockData {
  id: string;
  warehouseId: string;
  partId: string;
  lotId?: string;
  qty: number;
  reservedQty: number;
  availableQty: number;
  lastTransAt: string;
  warehouse: {
    warehouseCode: string;
    warehouseName: string;
    warehouseType: string;
  };
  part: {
    partCode: string;
    partName: string;
    partType: string;
    unit: string;
  };
  lot?: {
    lotNo: string;
    status: string;
  };
}

const getTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    WIP: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    FG: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    FLOOR: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    DEFECT: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    SCRAP: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  };
  return colors[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
};

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
    { value: 'WIP', label: t('inventory.stock.wip') },
    { value: 'FG', label: t('inventory.stock.fg') },
  ], [t]);

  // 필터
  const [filters, setFilters] = useState({
    warehouseType: '',
    partType: '',
    partCode: '',
    includeZero: false,
  });

  const fetchStocks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.warehouseType) params.append('warehouseType', filters.warehouseType);
      if (filters.partType) params.append('partType', filters.partType);
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
      if (stock.part?.partType === 'RAW') return false;
      if (stock.warehouse?.warehouseType === 'RAW') return false;
      if (filters.partCode && !stock.part.partCode.includes(filters.partCode)) return false;
      return true;
    });
  }, [stocks, filters.partCode]);

  const columns: ColumnDef<StockData>[] = [
    // 창고 유형 배지
    {
      accessorKey: 'warehouseType',
      header: t('inventory.stock.warehouseType'),
      size: 100,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }: CellContext<StockData, unknown>) => {
        const type = getValue() as string;
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(type)}`}>
            {type}
          </span>
        );
      },
    },
    // 창고 코드, 명 (공통 유틸리티)
    ...createWarehouseColumns<StockData>(t),
    // 품목 코드, 명 (공통 유틸리티)
    ...createPartColumns<StockData>(t),
    // LOT 번호
    {
      accessorKey: 'lotNo',
      header: t('inventory.stock.lot'),
      size: 150,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }: CellContext<StockData, unknown>) => getValue() || '-',
    },
    // 현재고
    createQtyColumn<StockData>(t, 'qty'),
    // 예약수량
    {
      ...createQtyColumn<StockData>(t, 'reservedQty'),
      header: t('inventory.stock.reserved'),
      size: 80,
    },
    // 가용수량 (커스텀 색상)
    {
      accessorKey: 'availableQty',
      header: t('inventory.stock.available'),
      size: 100,
      cell: ({ getValue }: CellContext<StockData, unknown>) => {
        const value = getValue() as number;
        return (
          <span className={value <= 0 ? 'text-red-500 font-semibold' : 'text-green-600 font-semibold'}>
            {value.toLocaleString()}
          </span>
        );
      },
      meta: { filterType: 'number' as const, align: 'right' },
    },
    // 단위
    {
      accessorKey: 'unit',
      header: t('inventory.stock.unit'),
      size: 60,
      meta: { filterType: 'text' as const },
    },
    // 마지막 거래일 (공통 유틸리티)
    createDateColumn<StockData>(t, 'lastTransAt', t('inventory.stock.lastTransaction'), { size: 150 }),
  ];

  // 통계 계산 (필터링된 제품재고 기준)
  const totalStock = filteredStocks.reduce((sum, s) => sum + s.qty, 0);
  const totalAvailable = filteredStocks.reduce((sum, s) => sum + s.availableQty, 0);
  const partCount = new Set(filteredStocks.map(s => s.partId)).size;
  const lotCount = filteredStocks.filter(s => s.lotId).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Package className="w-7 h-7 text-primary" />{t('inventory.stock.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('inventory.stock.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchStocks}><RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t('inventory.stock.totalStock')} value={totalStock} icon={Package} color="blue" />
        <StatCard label={t('inventory.stock.availableStock')} value={totalAvailable} icon={CheckCircle} color="green" />
        <StatCard label={t('inventory.stock.partCount')} value={partCount} icon={Layers} color="purple" />
        <StatCard label={t('inventory.stock.lotCount')} value={lotCount} icon={Hash} color="orange" />
      </div>

      <Card>
        <CardContent>
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
                  <Input placeholder={t('inventory.stock.searchPartCode')} value={filters.partCode} onChange={(e) => setFilters({ ...filters, partCode: e.target.value })} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <Select options={WAREHOUSE_TYPES} value={filters.warehouseType} onChange={(v) => setFilters({ ...filters, warehouseType: v })} placeholder={t('inventory.stock.warehouseType')} />
                <Select options={PART_TYPES} value={filters.partType} onChange={(v) => setFilters({ ...filters, partType: v })} placeholder={t('inventory.stock.partType')} />
                <div className="flex items-center gap-2 flex-shrink-0">
                  <input type="checkbox" id="includeZero" checked={filters.includeZero} onChange={(e) => setFilters({ ...filters, includeZero: e.target.checked })} />
                  <label htmlFor="includeZero" className="text-sm text-text-muted">{t('common.includeZero')}</label>
                </div>
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
