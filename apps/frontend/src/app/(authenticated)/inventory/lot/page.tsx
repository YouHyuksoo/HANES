"use client";

/**
 * @file src/pages/inventory/LotPage.tsx
 * @description LOT 관리 페이지 - LOT 추적 및 이력 조회
 */
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Tag, Search, RefreshCw, Eye, Layers, CheckCircle, AlertCircle, MinusCircle } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, Modal, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { api } from '@/services/api';

interface LotData {
  id: string;
  lotNo: string;
  partId: string;
  partType: string;
  initQty: number;
  currentQty: number;
  recvDate?: string;
  expireDate?: string;
  origin?: string;
  vendor?: string;
  invoiceNo?: string;
  poNo?: string;
  status: string;
  createdAt: string;
  part: {
    partCode: string;
    partName: string;
    unit: string;
  };
  parentLot?: {
    lotNo: string;
  };
}

interface LotDetail extends LotData {
  childLots: Array<{ id: string; lotNo: string; partType: string }>;
  stocks: Array<{
    id: string;
    qty: number;
    warehouse: { warehouseCode: string; warehouseName: string };
  }>;
  transactions: Array<{
    id: string;
    transNo: string;
    transType: string;
    transDate: string;
    qty: number;
  }>;
}

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    NORMAL: 'bg-green-100 text-green-800',
    HOLD: 'bg-yellow-100 text-yellow-800',
    DEPLETED: 'bg-gray-100 text-gray-800',
    EXPIRED: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

const getPartTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    RAW: 'bg-blue-100 text-blue-800',
    WIP: 'bg-yellow-100 text-yellow-800',
    FG: 'bg-green-100 text-green-800',
  };
  return colors[type] || 'bg-gray-100 text-gray-800';
};

export default function LotPage() {
  const { t } = useTranslation();
  const [lots, setLots] = useState<LotData[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedLot, setSelectedLot] = useState<LotDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'info' | 'stock' | 'history'>('info');

  const PART_TYPES = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'RAW', label: t('inventory.stock.raw') },
    { value: 'WIP', label: t('inventory.stock.wip') },
    { value: 'FG', label: t('inventory.stock.fg') },
  ], [t]);

  const LOT_STATUS = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'NORMAL', label: t('inventory.lot.normal') },
    { value: 'HOLD', label: t('inventory.lot.hold') },
    { value: 'DEPLETED', label: t('inventory.lot.depleted') },
    { value: 'EXPIRED', label: t('inventory.lot.expired') },
  ], [t]);

  const getStatusLabel = (status: string) => {
    return LOT_STATUS.find(s => s.value === status)?.label || status;
  };

  const getPartTypeLabel = (type: string) => {
    return PART_TYPES.find(pt => pt.value === type)?.label || type;
  };

  // 필터
  const [filters, setFilters] = useState({
    partType: '',
    status: '',
    lotNo: '',
  });

  const fetchLots = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.partType) params.append('partType', filters.partType);
      if (filters.status) params.append('status', filters.status);

      const res = await api.get(`/inventory/lots?${params.toString()}`);
      const result = res.data?.data ?? res.data;
      setLots(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('LOT 목록 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLots();
  }, []);

  const handleViewDetail = async (lot: LotData) => {
    setDetailLoading(true);
    setDetailModalOpen(true);
    setDetailTab('info');
    try {
      const res = await api.get(`/inventory/lots/${lot.id}`);
      setSelectedLot(res.data?.data ?? res.data);
    } catch (error) {
      console.error('LOT 상세 조회 실패:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const columns: ColumnDef<LotData>[] = useMemo(() => [
    {
      accessorKey: 'lotNo',
      header: t('inventory.lot.lotNo'),
      size: 160,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'partType',
      header: t('inventory.lot.partType'),
      size: 100,
      meta: { filterType: 'multi' as const },
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${getPartTypeColor(row.original.partType)}`}>
          {getPartTypeLabel(row.original.partType)}
        </span>
      ),
    },
    {
      accessorKey: 'partCode',
      header: t('inventory.lot.partCode'),
      size: 120,
      meta: { filterType: 'text' as const },
      cell: ({ row }) => row.original.part.partCode,
    },
    {
      accessorKey: 'partName',
      header: t('inventory.lot.partName'),
      size: 180,
      meta: { filterType: 'text' as const },
      cell: ({ row }) => row.original.part.partName,
    },
    {
      accessorKey: 'initQty',
      header: t('inventory.lot.initQty'),
      size: 100,
      meta: { filterType: 'number' as const },
      cell: ({ row }) => row.original.initQty.toLocaleString(),
    },
    {
      accessorKey: 'currentQty',
      header: t('inventory.lot.currentQty'),
      size: 100,
      meta: { filterType: 'number' as const },
      cell: ({ row }) => (
        <span className={row.original.currentQty <= 0 ? 'text-gray-400' : 'font-semibold'}>
          {row.original.currentQty.toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: 'usage',
      header: t('inventory.lot.usageRate'),
      size: 80,
      meta: { filterType: 'number' as const },
      cell: ({ row }) => {
        const rate = row.original.initQty > 0
          ? ((row.original.initQty - row.original.currentQty) / row.original.initQty * 100)
          : 0;
        return <span className="text-sm">{rate.toFixed(1)}%</span>;
      },
    },
    {
      accessorKey: 'status',
      header: t('inventory.lot.status'),
      size: 80,
      meta: { filterType: 'multi' as const },
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(row.original.status)}`}>
          {getStatusLabel(row.original.status)}
        </span>
      ),
    },
    {
      accessorKey: 'vendor',
      header: t('inventory.lot.vendor'),
      size: 100,
      meta: { filterType: 'text' as const },
      cell: ({ row }) => row.original.vendor || '-',
    },
    {
      accessorKey: 'recvDate',
      header: t('inventory.lot.recvDate'),
      size: 100,
      meta: { filterType: 'date' as const },
      cell: ({ row }) => row.original.recvDate ? new Date(row.original.recvDate).toLocaleDateString() : '-',
    },
    {
      accessorKey: 'expireDate',
      header: t('inventory.lot.expireDate'),
      size: 100,
      meta: { filterType: 'date' as const },
      cell: ({ row }) => {
        if (!row.original.expireDate) return '-';
        const date = new Date(row.original.expireDate);
        const isExpired = date < new Date();
        return (
          <span className={isExpired ? 'text-red-600 font-semibold' : ''}>
            {date.toLocaleDateString()}
          </span>
        );
      },
    },
    {
      accessorKey: 'parentLot',
      header: t('inventory.lot.parentLot'),
      size: 140,
      meta: { filterType: 'text' as const },
      cell: ({ row }) => row.original.parentLot?.lotNo || '-',
    },
    {
      id: 'actions',
      header: '',
      size: 80,
      meta: { filterType: 'none' as const },
      cell: ({ row }) => (
        <button onClick={() => handleViewDetail(row.original)} className="p-1 hover:bg-surface rounded" title={t('common.detail')}>
          <Eye className="w-4 h-4 text-primary" />
        </button>
      ),
    },
  ], [t]);

  // 필터링
  const filteredLots = useMemo(() => {
    return lots.filter(lot => {
      if (filters.lotNo && !lot.lotNo.includes(filters.lotNo)) return false;
      return true;
    });
  }, [lots, filters.lotNo]);

  // 통계
  const normalCount = lots.filter(l => l.status === 'NORMAL').length;
  const holdCount = lots.filter(l => l.status === 'HOLD').length;
  const depletedCount = lots.filter(l => l.status === 'DEPLETED').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Tag className="w-7 h-7 text-primary" />{t('inventory.lot.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('inventory.lot.subtitle')}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchLots}><RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}</Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t('inventory.lot.totalLot')} value={lots.length} icon={Layers} color="blue" />
        <StatCard label={t('inventory.lot.normal')} value={normalCount} icon={CheckCircle} color="green" />
        <StatCard label={t('inventory.lot.hold')} value={holdCount} icon={AlertCircle} color="yellow" />
        <StatCard label={t('inventory.lot.depleted')} value={depletedCount} icon={MinusCircle} color="gray" />
      </div>

      <Card>
        <CardContent>
          <DataGrid
            data={filteredLots}
            columns={columns}
            isLoading={loading}
            enableColumnFilter
            enableExport
            exportFileName={t('inventory.lot.title')}
            emptyMessage={t('inventory.lot.emptyMessage')}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t('inventory.lot.searchLotNo')} value={filters.lotNo} onChange={(e) => setFilters({ ...filters, lotNo: e.target.value })} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <div className="w-32 flex-shrink-0">
                  <Select options={PART_TYPES} value={filters.partType} onChange={(v) => setFilters({ ...filters, partType: v })} fullWidth />
                </div>
                <div className="w-32 flex-shrink-0">
                  <Select options={LOT_STATUS} value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} fullWidth />
                </div>
                <Button variant="secondary" size="sm" onClick={fetchLots} className="flex-shrink-0">
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>

      {/* LOT 상세 모달 */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={t('inventory.lot.detailTitle')}
        size="lg"
      >
        {detailLoading ? (
          <div className="py-8 text-center text-gray-500">{t('common.loading')}</div>
        ) : selectedLot ? (
          <div className="space-y-4">
            {/* 탭 버튼 */}
            <div className="flex border-b">
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                  detailTab === 'info' ? 'border-primary text-primary' : 'border-transparent text-gray-500'
                }`}
                onClick={() => setDetailTab('info')}
              >
                {t('inventory.lot.tabInfo')}
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                  detailTab === 'stock' ? 'border-primary text-primary' : 'border-transparent text-gray-500'
                }`}
                onClick={() => setDetailTab('stock')}
              >
                {t('inventory.lot.tabStock')}
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                  detailTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-gray-500'
                }`}
                onClick={() => setDetailTab('history')}
              >
                {t('inventory.lot.tabHistory')}
              </button>
            </div>

            {/* 기본정보 탭 */}
            {detailTab === 'info' && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">{t('inventory.lot.lotNo')}</span>
                    <span className="font-medium">{selectedLot.lotNo}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">{t('inventory.lot.partType')}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${getPartTypeColor(selectedLot.partType)}`}>
                      {getPartTypeLabel(selectedLot.partType)}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">{t('inventory.lot.partCode')}</span>
                    <span>{selectedLot.part.partCode}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">{t('inventory.lot.partName')}</span>
                    <span>{selectedLot.part.partName}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">{t('inventory.lot.status')}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(selectedLot.status)}`}>
                      {getStatusLabel(selectedLot.status)}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">{t('inventory.lot.initQty')}</span>
                    <span>{selectedLot.initQty.toLocaleString()} {selectedLot.part.unit}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">{t('inventory.lot.currentQty')}</span>
                    <span className="font-semibold">{selectedLot.currentQty.toLocaleString()} {selectedLot.part.unit}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">{t('inventory.lot.vendor')}</span>
                    <span>{selectedLot.vendor || '-'}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">{t('inventory.lot.recvDate')}</span>
                    <span>{selectedLot.recvDate ? new Date(selectedLot.recvDate).toLocaleDateString() : '-'}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">{t('inventory.lot.expireDate')}</span>
                    <span>{selectedLot.expireDate ? new Date(selectedLot.expireDate).toLocaleDateString() : '-'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 재고현황 탭 */}
            {detailTab === 'stock' && (
              <div className="space-y-2">
                {selectedLot.stocks?.length > 0 ? (
                  selectedLot.stocks.map(stock => (
                    <div key={stock.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="font-medium">{stock.warehouse.warehouseCode}</span>
                        <span className="text-gray-500 text-sm ml-2">{stock.warehouse.warehouseName}</span>
                      </div>
                      <span className="font-semibold">{stock.qty.toLocaleString()} {selectedLot.part.unit}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">{t('inventory.lot.noStock')}</div>
                )}
              </div>
            )}

            {/* 이력 탭 */}
            {detailTab === 'history' && (
              <div className="space-y-2 max-h-[300px] overflow-auto">
                {selectedLot.transactions?.length > 0 ? (
                  selectedLot.transactions.map(trans => (
                    <div key={trans.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm">
                      <div>
                        <span className="font-mono">{trans.transNo}</span>
                        <span className="text-gray-500 ml-2">
                          {new Date(trans.transDate).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-100">{trans.transType}</span>
                        <span className={trans.qty > 0 ? 'text-blue-600 font-semibold' : 'text-red-600 font-semibold'}>
                          {trans.qty > 0 ? '+' : ''}{trans.qty.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">{t('inventory.lot.noHistory')}</div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button variant="secondary" onClick={() => setDetailModalOpen(false)}>
                {t('common.close')}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
