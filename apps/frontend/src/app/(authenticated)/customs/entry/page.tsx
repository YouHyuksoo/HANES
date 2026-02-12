"use client";

/**
 * @file src/pages/customs/EntryPage.tsx
 * @description 보세 수입신고 관리 페이지
 */
import { useState, useMemo } from 'react';
import { Plus, Edit2, Eye, RefreshCw, FileText, Search, CheckCircle, Package, Layers } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface CustomsEntry {
  id: string;
  entryNo: string;
  blNo: string;
  invoiceNo: string;
  declarationDate: string;
  clearanceDate: string | null;
  origin: string;
  hsCode: string;
  totalAmount: number;
  currency: string;
  status: string;
  lotCount: number;
}

const mockData: CustomsEntry[] = [
  {
    id: '1',
    entryNo: 'IMP20250125001',
    blNo: 'MSCU1234567',
    invoiceNo: 'INV-2025-001',
    declarationDate: '2025-01-25',
    clearanceDate: '2025-01-26',
    origin: 'CN',
    hsCode: '8544.30',
    totalAmount: 15000,
    currency: 'USD',
    status: 'CLEARED',
    lotCount: 5,
  },
  {
    id: '2',
    entryNo: 'IMP20250124001',
    blNo: 'COSCO9876543',
    invoiceNo: 'INV-2025-002',
    declarationDate: '2025-01-24',
    clearanceDate: null,
    origin: 'JP',
    hsCode: '8536.90',
    totalAmount: 8500,
    currency: 'USD',
    status: 'PENDING',
    lotCount: 3,
  },
];

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  CLEARED: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  RELEASED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
};

const statusLabels: Record<string, string> = {
  PENDING: '신고대기',
  CLEARED: '통관완료',
  RELEASED: '반출완료',
};

function CustomsEntryPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CustomsEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = useMemo(() => {
    if (!searchTerm) return mockData;
    return mockData.filter(
      (item) =>
        item.entryNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.blNo.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const columns = useMemo<ColumnDef<CustomsEntry>[]>(
    () => [
      { accessorKey: 'entryNo', header: '수입신고번호', size: 140 },
      { accessorKey: 'blNo', header: 'B/L번호', size: 120 },
      { accessorKey: 'invoiceNo', header: '인보이스번호', size: 120 },
      { accessorKey: 'declarationDate', header: '신고일', size: 100 },
      { accessorKey: 'clearanceDate', header: '통관일', size: 100,
        cell: ({ getValue }) => getValue() || '-'
      },
      { accessorKey: 'origin', header: '원산지', size: 70 },
      { accessorKey: 'hsCode', header: 'HS코드', size: 90 },
      {
        accessorKey: 'totalAmount',
        header: '금액',
        size: 100,
        cell: ({ row }) => `${row.original.totalAmount.toLocaleString()} ${row.original.currency}`,
      },
      {
        accessorKey: 'status',
        header: '상태',
        size: 90,
        cell: ({ getValue }) => {
          const status = getValue() as string;
          return (
            <span className={`px-2 py-1 text-xs rounded-full ${statusColors[status]}`}>
              {statusLabels[status]}
            </span>
          );
        },
      },
      { accessorKey: 'lotCount', header: 'LOT수', size: 70 },
      {
        id: 'actions',
        header: '관리',
        size: 100,
        cell: ({ row }) => (
          <div className="flex gap-1">
            <button
              onClick={() => { setSelectedEntry(row.original); setIsModalOpen(true); }}
              className="p-1 hover:bg-surface rounded"
              title="상세보기"
            >
              <Eye className="w-4 h-4 text-primary" />
            </button>
            <button className="p-1 hover:bg-surface rounded" title="수정">
              <Edit2 className="w-4 h-4 text-text-muted" />
            </button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><FileText className="w-7 h-7 text-primary" />보세 수입신고 관리</h1>
          <p className="text-text-muted mt-1">수입신고 및 통관 현황을 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
          </Button>
          <Button size="sm" onClick={() => { setSelectedEntry(null); setIsModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> 신고등록
          </Button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="신고대기" value={3} icon={FileText} color="yellow" />
        <StatCard label="통관완료" value={12} icon={CheckCircle} color="blue" />
        <StatCard label="반출완료" value={45} icon={Package} color="green" />
        <StatCard label="보세재고(LOT)" value={28} icon={Layers} color="purple" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder="신고번호, B/L, 인보이스 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid data={filteredData} columns={columns} pageSize={10} />
        </CardContent>
      </Card>

      {/* 등록/수정 모달 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedEntry ? '수입신고 상세' : '수입신고 등록'}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <Input label="수입신고번호" placeholder="IMP20250125001" defaultValue={selectedEntry?.entryNo} fullWidth />
          <Input label="B/L번호" placeholder="MSCU1234567" defaultValue={selectedEntry?.blNo} fullWidth />
          <Input label="인보이스번호" placeholder="INV-2025-001" defaultValue={selectedEntry?.invoiceNo} fullWidth />
          <Input label="원산지" placeholder="CN" defaultValue={selectedEntry?.origin} fullWidth />
          <Input label="HS코드" placeholder="8544.30" defaultValue={selectedEntry?.hsCode} fullWidth />
          <Input label="금액" type="number" placeholder="15000" defaultValue={selectedEntry?.totalAmount?.toString()} fullWidth />
          <Input label="통화" placeholder="USD" defaultValue={selectedEntry?.currency} fullWidth />
          <Input label="신고일" type="date" defaultValue={selectedEntry?.declarationDate} fullWidth />
          <Input label="통관일" type="date" defaultValue={selectedEntry?.clearanceDate || ''} fullWidth />
          <Select
            label="상태"
            options={[
              { value: 'PENDING', label: '신고대기' },
              { value: 'CLEARED', label: '통관완료' },
              { value: 'RELEASED', label: '반출완료' },
            ]}
            defaultValue={selectedEntry?.status || 'PENDING'}
            fullWidth
          />
        </div>
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>취소</Button>
          <Button>{selectedEntry ? '수정' : '등록'}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default CustomsEntryPage;
