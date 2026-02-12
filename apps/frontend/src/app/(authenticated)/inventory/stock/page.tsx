"use client";

/**
 * @file src/pages/inventory/InventoryStockPage.tsx
 * @description 재고 현황 페이지 - 창고별/품목별 재고 조회
 */
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, RefreshCw, Search, Download, CheckCircle, Layers, Hash } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { api } from '@/services/api';

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
    RAW: 'bg-blue-100 text-blue-800',
    WIP: 'bg-yellow-100 text-yellow-800',
    FG: 'bg-green-100 text-green-800',
    FLOOR: 'bg-purple-100 text-purple-800',
    DEFECT: 'bg-red-100 text-red-800',
    SCRAP: 'bg-gray-100 text-gray-800',
  };
  return colors[type] || 'bg-gray-100 text-gray-800';
};

export default function InventoryStockPage() {
  const { t } = useTranslation();
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(false);

  const WAREHOUSE_TYPES = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'RAW', label: t('inventory.stock.raw') },
    { value: 'WIP', label: t('inventory.stock.wip') },
    { value: 'FG', label: t('inventory.stock.fg') },
    { value: 'FLOOR', label: t('inventory.stock.floor') },
    { value: 'DEFECT', label: t('inventory.stock.defect') },
    { value: 'SCRAP', label: t('inventory.stock.scrap') },
  ], [t]);

  const PART_TYPES = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'RAW', label: t('inventory.stock.raw') },
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

  // 필터링된 데이터
  const filteredStocks = useMemo(() => {
    return stocks.filter(stock => {
      if (filters.partCode && !stock.part.partCode.includes(filters.partCode)) return false;
      return true;
    });
  }, [stocks, filters.partCode]);

  const columns: ColumnDef<StockData>[] = useMemo(() => [
    {
      accessorKey: 'warehouseType',
      header: t('inventory.stock.warehouseType'),
      size: 100,
      cell: ({ row }) => {
        const type = row.original.warehouse.warehouseType;
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(type)}`}>
            {type}
          </span>
        );
      },
    },
    {
      accessorKey: 'warehouseCode',
      header: t('inventory.stock.warehouseCode'),
      size: 120,
      cell: ({ row }) => row.original.warehouse.warehouseCode,
    },
    {
      accessorKey: 'warehouseName',
      header: t('inventory.stock.warehouseName'),
      size: 150,
      cell: ({ row }) => row.original.warehouse.warehouseName,
    },
    {
      accessorKey: 'partCode',
      header: t('inventory.stock.partCode'),
      size: 120,
      cell: ({ row }) => row.original.part.partCode,
    },
    {
      accessorKey: 'partName',
      header: t('inventory.stock.partName'),
      size: 180,
      cell: ({ row }) => row.original.part.partName,
    },
    {
      accessorKey: 'lotNo',
      header: t('inventory.stock.lot'),
      size: 150,
      cell: ({ row }) => row.original.lot?.lotNo || '-',
    },
    {
      accessorKey: 'qty',
      header: t('inventory.stock.currentStock'),
      size: 100,
      cell: ({ row }) => row.original.qty.toLocaleString(),
    },
    {
      accessorKey: 'reservedQty',
      header: t('inventory.stock.reserved'),
      size: 80,
      cell: ({ row }) => row.original.reservedQty.toLocaleString(),
    },
    {
      accessorKey: 'availableQty',
      header: t('inventory.stock.available'),
      size: 100,
      cell: ({ row }) => (
        <span className={row.original.availableQty <= 0 ? 'text-red-500 font-semibold' : 'text-green-600 font-semibold'}>
          {row.original.availableQty.toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: 'unit',
      header: t('inventory.stock.unit'),
      size: 60,
      cell: ({ row }) => row.original.part.unit,
    },
    {
      accessorKey: 'lastTransAt',
      header: t('inventory.stock.lastTransaction'),
      size: 150,
      cell: ({ row }) => row.original.lastTransAt ? new Date(row.original.lastTransAt).toLocaleString() : '-',
    },
  ], [t]);

  // 통계 계산
  const totalStock = stocks.reduce((sum, s) => sum + s.qty, 0);
  const totalAvailable = stocks.reduce((sum, s) => sum + s.availableQty, 0);
  const partCount = new Set(stocks.map(s => s.partId)).size;
  const lotCount = stocks.filter(s => s.lotId).length;

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
          <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />{t('common.excel')}</Button>
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
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder={t('inventory.stock.searchPartCode')} value={filters.partCode} onChange={(e) => setFilters({ ...filters, partCode: e.target.value })} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <Select options={WAREHOUSE_TYPES} value={filters.warehouseType} onChange={(v) => setFilters({ ...filters, warehouseType: v })} placeholder={t('inventory.stock.warehouseType')} />
            <Select options={PART_TYPES} value={filters.partType} onChange={(v) => setFilters({ ...filters, partType: v })} placeholder={t('inventory.stock.partType')} />
            <div className="flex items-center gap-2">
              <input type="checkbox" id="includeZero" checked={filters.includeZero} onChange={(e) => setFilters({ ...filters, includeZero: e.target.checked })} />
              <label htmlFor="includeZero" className="text-sm text-text-muted">{t('common.includeZero')}</label>
            </div>
            <Button variant="secondary" onClick={fetchStocks}><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid
            data={filteredStocks}
            columns={columns}
            isLoading={loading}
            pageSize={10}
            emptyMessage={t('inventory.stock.emptyMessage')}
          />
        </CardContent>
      </Card>
    </div>
  );
}
