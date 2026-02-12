"use client";

/**
 * @file src/pages/inventory/LotPage.tsx
 * @description LOT 관리 페이지 - LOT 추적 및 이력 조회
 */
import { useState, useEffect, useMemo } from 'react';
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

const PART_TYPES = [
  { value: '', label: '전체' },
  { value: 'RAW', label: '원자재' },
  { value: 'WIP', label: '반제품' },
  { value: 'FG', label: '완제품' },
];

const LOT_STATUS = [
  { value: '', label: '전체' },
  { value: 'NORMAL', label: '정상' },
  { value: 'HOLD', label: '보류' },
  { value: 'DEPLETED', label: '소진' },
  { value: 'EXPIRED', label: '만료' },
];

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

const getStatusLabel = (status: string) => {
  return LOT_STATUS.find(s => s.value === status)?.label || status;
};

const getPartTypeLabel = (type: string) => {
  return PART_TYPES.find(t => t.value === type)?.label || type;
};

export default function LotPage() {
  const [lots, setLots] = useState<LotData[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedLot, setSelectedLot] = useState<LotDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'info' | 'stock' | 'history'>('info');

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
      setLots(res.data);
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
      setSelectedLot(res.data);
    } catch (error) {
      console.error('LOT 상세 조회 실패:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const columns: ColumnDef<LotData>[] = useMemo(() => [
    {
      accessorKey: 'lotNo',
      header: 'LOT 번호',
      size: 160,
    },
    {
      accessorKey: 'partType',
      header: '품목유형',
      size: 100,
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${getPartTypeColor(row.original.partType)}`}>
          {getPartTypeLabel(row.original.partType)}
        </span>
      ),
    },
    {
      accessorKey: 'partCode',
      header: '품목코드',
      size: 120,
      cell: ({ row }) => row.original.part.partCode,
    },
    {
      accessorKey: 'partName',
      header: '품목명',
      size: 180,
      cell: ({ row }) => row.original.part.partName,
    },
    {
      accessorKey: 'initQty',
      header: '초기수량',
      size: 100,
      cell: ({ row }) => row.original.initQty.toLocaleString(),
    },
    {
      accessorKey: 'currentQty',
      header: '현재수량',
      size: 100,
      cell: ({ row }) => (
        <span className={row.original.currentQty <= 0 ? 'text-gray-400' : 'font-semibold'}>
          {row.original.currentQty.toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: 'usage',
      header: '사용률',
      size: 80,
      cell: ({ row }) => {
        const rate = row.original.initQty > 0
          ? ((row.original.initQty - row.original.currentQty) / row.original.initQty * 100)
          : 0;
        return <span className="text-sm">{rate.toFixed(1)}%</span>;
      },
    },
    {
      accessorKey: 'status',
      header: '상태',
      size: 80,
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(row.original.status)}`}>
          {getStatusLabel(row.original.status)}
        </span>
      ),
    },
    {
      accessorKey: 'vendor',
      header: '공급처',
      size: 100,
      cell: ({ row }) => row.original.vendor || '-',
    },
    {
      accessorKey: 'recvDate',
      header: '입고일',
      size: 100,
      cell: ({ row }) => row.original.recvDate ? new Date(row.original.recvDate).toLocaleDateString() : '-',
    },
    {
      accessorKey: 'expireDate',
      header: '만료일',
      size: 100,
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
      header: '원LOT',
      size: 140,
      cell: ({ row }) => row.original.parentLot?.lotNo || '-',
    },
    {
      id: 'actions',
      header: '',
      size: 80,
      cell: ({ row }) => (
        <button onClick={() => handleViewDetail(row.original)} className="p-1 hover:bg-surface rounded" title="상세">
          <Eye className="w-4 h-4 text-primary" />
        </button>
      ),
    },
  ], []);

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
            <Tag className="w-7 h-7 text-primary" />LOT 관리
          </h1>
          <p className="text-text-muted mt-1">품목별 LOT 추적 및 이력을 관리합니다.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchLots}><RefreshCw className="w-4 h-4 mr-1" />새로고침</Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="총 LOT" value={lots.length} icon={Layers} color="blue" />
        <StatCard label="정상" value={normalCount} icon={CheckCircle} color="green" />
        <StatCard label="보류" value={holdCount} icon={AlertCircle} color="yellow" />
        <StatCard label="소진" value={depletedCount} icon={MinusCircle} color="gray" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder="LOT 번호 검색..." value={filters.lotNo} onChange={(e) => setFilters({ ...filters, lotNo: e.target.value })} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <Select options={PART_TYPES} value={filters.partType} onChange={(v) => setFilters({ ...filters, partType: v })} placeholder="품목유형" />
            <Select options={LOT_STATUS} value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} placeholder="상태" />
            <Button variant="secondary" onClick={fetchLots}><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid
            data={filteredLots}
            columns={columns}
            isLoading={loading}
            pageSize={10}
            emptyMessage="LOT 데이터가 없습니다."
          />
        </CardContent>
      </Card>

      {/* LOT 상세 모달 */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title="LOT 상세 정보"
        size="lg"
      >
        {detailLoading ? (
          <div className="py-8 text-center text-gray-500">로딩 중...</div>
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
                기본정보
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                  detailTab === 'stock' ? 'border-primary text-primary' : 'border-transparent text-gray-500'
                }`}
                onClick={() => setDetailTab('stock')}
              >
                재고현황
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                  detailTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-gray-500'
                }`}
                onClick={() => setDetailTab('history')}
              >
                이력
              </button>
            </div>

            {/* 기본정보 탭 */}
            {detailTab === 'info' && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">LOT 번호</span>
                    <span className="font-medium">{selectedLot.lotNo}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">품목유형</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${getPartTypeColor(selectedLot.partType)}`}>
                      {getPartTypeLabel(selectedLot.partType)}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">품목코드</span>
                    <span>{selectedLot.part.partCode}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">품목명</span>
                    <span>{selectedLot.part.partName}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">상태</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(selectedLot.status)}`}>
                      {getStatusLabel(selectedLot.status)}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">초기수량</span>
                    <span>{selectedLot.initQty.toLocaleString()} {selectedLot.part.unit}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">현재수량</span>
                    <span className="font-semibold">{selectedLot.currentQty.toLocaleString()} {selectedLot.part.unit}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">공급처</span>
                    <span>{selectedLot.vendor || '-'}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">입고일</span>
                    <span>{selectedLot.recvDate ? new Date(selectedLot.recvDate).toLocaleDateString() : '-'}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">만료일</span>
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
                  <div className="text-center py-8 text-gray-500">재고 없음</div>
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
                  <div className="text-center py-8 text-gray-500">이력 없음</div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button variant="secondary" onClick={() => setDetailModalOpen(false)}>
                닫기
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
