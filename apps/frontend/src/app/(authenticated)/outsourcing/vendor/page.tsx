"use client";

/**
 * @file src/pages/outsourcing/VendorPage.tsx
 * @description 외주처 관리 페이지
 */
import { useState, useMemo } from 'react';
import { Plus, Edit2, RefreshCw, Search, Building2 } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface Vendor {
  id: string;
  vendorCode: string;
  vendorName: string;
  bizNo: string;
  ceoName: string;
  tel: string;
  email: string;
  contactPerson: string;
  vendorType: string;
  address: string;
  useYn: string;
}

const mockData: Vendor[] = [
  {
    id: '1',
    vendorCode: 'VND-001',
    vendorName: '(주)하네스파트너',
    bizNo: '123-45-67890',
    ceoName: '김대표',
    tel: '02-1234-5678',
    email: 'contact@harness.co.kr',
    contactPerson: '이담당',
    vendorType: 'SUBCON',
    address: '경기도 안산시 단원구',
    useYn: 'Y',
  },
  {
    id: '2',
    vendorCode: 'VND-002',
    vendorName: '우성전선(주)',
    bizNo: '234-56-78901',
    ceoName: '박대표',
    tel: '031-987-6543',
    email: 'info@woosungwire.com',
    contactPerson: '최담당',
    vendorType: 'SUPPLIER',
    address: '경기도 시흥시 정왕동',
    useYn: 'Y',
  },
  {
    id: '3',
    vendorCode: 'VND-003',
    vendorName: '성진커넥터',
    bizNo: '345-67-89012',
    ceoName: '정대표',
    tel: '032-111-2222',
    email: 'sj@connector.kr',
    contactPerson: '김담당',
    vendorType: 'SUBCON',
    address: '인천시 남동구 논현동',
    useYn: 'Y',
  },
];

const vendorTypeLabels: Record<string, string> = {
  SUBCON: '외주',
  SUPPLIER: '공급',
};

function VendorPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Vendor | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = useMemo(() => {
    if (!searchTerm) return mockData;
    return mockData.filter(
      (item) =>
        item.vendorCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const columns = useMemo<ColumnDef<Vendor>[]>(
    () => [
      { accessorKey: 'vendorCode', header: '업체코드', size: 100 },
      { accessorKey: 'vendorName', header: '업체명', size: 150 },
      {
        accessorKey: 'vendorType',
        header: '유형',
        size: 70,
        cell: ({ getValue }) => {
          const type = getValue() as string;
          return (
            <span className={`px-2 py-1 text-xs rounded-full ${
              type === 'SUBCON'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
            }`}>
              {vendorTypeLabels[type]}
            </span>
          );
        },
      },
      { accessorKey: 'bizNo', header: '사업자번호', size: 120 },
      { accessorKey: 'ceoName', header: '대표자', size: 80 },
      { accessorKey: 'contactPerson', header: '담당자', size: 80 },
      { accessorKey: 'tel', header: '전화번호', size: 120 },
      { accessorKey: 'address', header: '주소', size: 180 },
      {
        accessorKey: 'useYn',
        header: '사용',
        size: 60,
        cell: ({ getValue }) => (
          <span className={getValue() === 'Y' ? 'text-green-600' : 'text-gray-400'}>
            {getValue() === 'Y' ? '●' : '○'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '관리',
        size: 70,
        cell: ({ row }) => (
          <button
            onClick={() => { setSelectedItem(row.original); setIsModalOpen(true); }}
            className="p-1 hover:bg-surface rounded"
          >
            <Edit2 className="w-4 h-4 text-primary" />
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
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Building2 className="w-7 h-7 text-primary" />외주처 관리</h1>
          <p className="text-text-muted mt-1">외주 협력업체 정보를 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
          </Button>
          <Button size="sm" onClick={() => { setSelectedItem(null); setIsModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> 업체 등록
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="전체 업체" value={mockData.length} icon={Building2} color="blue" />
        <StatCard label="외주업체" value={mockData.filter((d) => d.vendorType === 'SUBCON').length} icon={Building2} color="blue" />
        <StatCard label="공급업체" value={mockData.filter((d) => d.vendorType === 'SUPPLIER').length} icon={Building2} color="green" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder="업체코드, 업체명 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
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
        title={selectedItem ? '외주처 수정' : '외주처 등록'}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <Input label="업체코드" placeholder="VND-001" defaultValue={selectedItem?.vendorCode} fullWidth />
          <Select
            label="업체유형"
            options={[
              { value: 'SUBCON', label: '외주' },
              { value: 'SUPPLIER', label: '공급' },
            ]}
            defaultValue={selectedItem?.vendorType || 'SUBCON'}
            fullWidth
          />
          <Input label="업체명" placeholder="(주)하네스파트너" defaultValue={selectedItem?.vendorName} fullWidth className="col-span-2" />
          <Input label="사업자번호" placeholder="123-45-67890" defaultValue={selectedItem?.bizNo} fullWidth />
          <Input label="대표자" placeholder="김대표" defaultValue={selectedItem?.ceoName} fullWidth />
          <Input label="전화번호" placeholder="02-1234-5678" defaultValue={selectedItem?.tel} fullWidth />
          <Input label="팩스번호" placeholder="02-1234-5679" fullWidth />
          <Input label="이메일" placeholder="contact@example.com" defaultValue={selectedItem?.email} fullWidth />
          <Input label="담당자" placeholder="이담당" defaultValue={selectedItem?.contactPerson} fullWidth />
          <Input label="주소" placeholder="경기도 안산시 단원구" defaultValue={selectedItem?.address} fullWidth className="col-span-2" />
        </div>
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>취소</Button>
          <Button>{selectedItem ? '수정' : '등록'}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default VendorPage;
