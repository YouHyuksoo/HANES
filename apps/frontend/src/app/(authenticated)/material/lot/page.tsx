"use client";

/**
 * @file src/pages/material/lot/MatLotPage.tsx
 * @description 자재 LOT관리 페이지 - 자재 LOT별 이력/상태 조회
 *
 * 초보자 가이드:
 * 1. **LOT**: 동일 조건으로 입하된 자재 묶음 단위
 * 2. **추적**: LOT번호로 입하→IQC→입고→출고 이력 추적 가능
 * 3. **상태**: NORMAL(정상), HOLD(보류), DEPLETED(소진)
 */
import { useState, useMemo } from 'react';
import { Tag, Search, RefreshCw, Eye, Layers, CheckCircle, AlertCircle, MinusCircle } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, Modal, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface MatLotItem {
  id: string;
  lotNo: string;
  partCode: string;
  partName: string;
  initQty: number;
  currentQty: number;
  unit: string;
  vendor: string;
  recvDate: string;
  iqcStatus: string;
  status: string;
}

const LOT_STATUS = [
  { value: '', label: '전체 상태' },
  { value: 'NORMAL', label: '정상' },
  { value: 'HOLD', label: '보류' },
  { value: 'DEPLETED', label: '소진' },
];

const IQC_STATUS = [
  { value: '', label: '전체 IQC' },
  { value: 'PASS', label: '합격' },
  { value: 'FAIL', label: '불합격' },
  { value: 'HOLD', label: '보류' },
];

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    NORMAL: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    HOLD: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    DEPLETED: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

const getIqcColor = (status: string) => {
  const colors: Record<string, string> = {
    PASS: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    FAIL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    HOLD: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    PENDING: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

/** Mock 데이터 */
const mockLots: MatLotItem[] = [
  { id: '1', lotNo: 'L20250126-A01', partCode: 'WIRE-001', partName: 'AWG18 적색', initQty: 5000, currentQty: 4200, unit: 'M', vendor: '대한전선', recvDate: '2025-01-26', iqcStatus: 'PASS', status: 'NORMAL' },
  { id: '2', lotNo: 'L20250126-B01', partCode: 'TERM-001', partName: '단자 110형', initQty: 10000, currentQty: 10000, unit: 'EA', vendor: '한국단자', recvDate: '2025-01-26', iqcStatus: 'PASS', status: 'NORMAL' },
  { id: '3', lotNo: 'L20250125-C01', partCode: 'CONN-001', partName: '커넥터 6핀', initQty: 2000, currentQty: 1500, unit: 'EA', vendor: '삼성커넥터', recvDate: '2025-01-25', iqcStatus: 'PASS', status: 'NORMAL' },
  { id: '4', lotNo: 'L20250125-A02', partCode: 'WIRE-002', partName: 'AWG20 흑색', initQty: 3000, currentQty: 0, unit: 'M', vendor: '대한전선', recvDate: '2025-01-25', iqcStatus: 'FAIL', status: 'DEPLETED' },
  { id: '5', lotNo: 'L20250124-B02', partCode: 'TERM-002', partName: '단자 250형', initQty: 8000, currentQty: 3000, unit: 'EA', vendor: '한국단자', recvDate: '2025-01-24', iqcStatus: 'PASS', status: 'NORMAL' },
  { id: '6', lotNo: 'L20250126-C02', partCode: 'CONN-002', partName: '커넥터 12핀', initQty: 1500, currentQty: 1500, unit: 'EA', vendor: '삼성커넥터', recvDate: '2025-01-26', iqcStatus: 'HOLD', status: 'HOLD' },
];

export default function MatLotPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [iqcFilter, setIqcFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedLot, setSelectedLot] = useState<MatLotItem | null>(null);

  const filteredLots = useMemo(() => {
    return mockLots.filter((lot) => {
      const matchStatus = !statusFilter || lot.status === statusFilter;
      const matchIqc = !iqcFilter || lot.iqcStatus === iqcFilter;
      const matchSearch =
        !searchText ||
        lot.lotNo.toLowerCase().includes(searchText.toLowerCase()) ||
        lot.partName.toLowerCase().includes(searchText.toLowerCase()) ||
        lot.vendor.toLowerCase().includes(searchText.toLowerCase());
      return matchStatus && matchIqc && matchSearch;
    });
  }, [statusFilter, iqcFilter, searchText]);

  const normalCount = mockLots.filter((l) => l.status === 'NORMAL').length;
  const holdCount = mockLots.filter((l) => l.status === 'HOLD').length;
  const depletedCount = mockLots.filter((l) => l.status === 'DEPLETED').length;

  const columns = useMemo<ColumnDef<MatLotItem>[]>(
    () => [
      { accessorKey: 'lotNo', header: 'LOT번호', size: 160 },
      { accessorKey: 'partCode', header: '품목코드', size: 110 },
      { accessorKey: 'partName', header: '품목명', size: 130 },
      { accessorKey: 'vendor', header: '공급업체', size: 100 },
      { accessorKey: 'recvDate', header: '입고일', size: 100 },
      {
        accessorKey: 'initQty',
        header: '초기수량',
        size: 100,
        cell: ({ row }) => <span>{row.original.initQty.toLocaleString()} {row.original.unit}</span>,
      },
      {
        accessorKey: 'currentQty',
        header: '현재수량',
        size: 100,
        cell: ({ row }) => (
          <span className={row.original.currentQty <= 0 ? 'text-text-muted' : 'font-semibold'}>
            {row.original.currentQty.toLocaleString()} {row.original.unit}
          </span>
        ),
      },
      {
        id: 'usage',
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
        accessorKey: 'iqcStatus',
        header: 'IQC',
        size: 80,
        cell: ({ getValue }) => {
          const status = getValue() as string;
          return <span className={`px-2 py-1 rounded text-xs font-medium ${getIqcColor(status)}`}>{status}</span>;
        },
      },
      {
        accessorKey: 'status',
        header: '상태',
        size: 80,
        cell: ({ getValue }) => {
          const status = getValue() as string;
          const label = LOT_STATUS.find((s) => s.value === status)?.label || status;
          return <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(status)}`}>{label}</span>;
        },
      },
      {
        id: 'actions',
        header: '',
        size: 60,
        cell: ({ row }) => (
          <button
            className="p-1 hover:bg-surface rounded"
            title="상세보기"
            onClick={() => { setSelectedLot(row.original); setDetailModalOpen(true); }}
          >
            <Eye className="w-4 h-4 text-primary" />
          </button>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Tag className="w-7 h-7 text-primary" />LOT관리
          </h1>
          <p className="text-text-muted mt-1">자재 LOT별 이력 및 상태를 관리합니다.</p>
        </div>
        <Button variant="secondary" size="sm">
          <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="총 LOT" value={mockLots.length} icon={Layers} color="blue" />
        <StatCard label="정상" value={normalCount} icon={CheckCircle} color="green" />
        <StatCard label="보류" value={holdCount} icon={AlertCircle} color="yellow" />
        <StatCard label="소진" value={depletedCount} icon={MinusCircle} color="gray" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="LOT번호, 품목명, 공급업체 검색..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth
              />
            </div>
            <div className="w-36">
              <Select options={LOT_STATUS} value={statusFilter} onChange={setStatusFilter} fullWidth />
            </div>
            <div className="w-36">
              <Select options={IQC_STATUS} value={iqcFilter} onChange={setIqcFilter} fullWidth />
            </div>
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid data={filteredLots} columns={columns} pageSize={10} />
        </CardContent>
      </Card>

      {/* LOT 상세 모달 */}
      <Modal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} title="LOT 상세 정보" size="md">
        {selectedLot && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-text-muted">LOT번호</span>
                  <span className="font-medium">{selectedLot.lotNo}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-text-muted">품목코드</span>
                  <span>{selectedLot.partCode}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-text-muted">품목명</span>
                  <span>{selectedLot.partName}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-text-muted">공급업체</span>
                  <span>{selectedLot.vendor}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-text-muted">입고일</span>
                  <span>{selectedLot.recvDate}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-text-muted">초기수량</span>
                  <span>{selectedLot.initQty.toLocaleString()} {selectedLot.unit}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-text-muted">현재수량</span>
                  <span className="font-semibold">{selectedLot.currentQty.toLocaleString()} {selectedLot.unit}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-text-muted">IQC 상태</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${getIqcColor(selectedLot.iqcStatus)}`}>
                    {selectedLot.iqcStatus}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <Button variant="secondary" onClick={() => setDetailModalOpen(false)}>닫기</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
