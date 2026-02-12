"use client";

/**
 * @file src/pages/master/PartnerPage.tsx
 * @description 거래처 마스터 관리 페이지
 *
 * 초보자 가이드:
 * 1. **거래처 유형**: SUPPLIER(공급상) / CUSTOMER(고객)
 * 2. **검색/필터**: 유형별 필터 + 텍스트 검색
 * 3. **CRUD**: 추가/수정은 Modal, 삭제는 소프트삭제
 */
import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, RefreshCw, Download, Building2 } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface Partner {
  id: string;
  partnerCode: string;
  partnerName: string;
  partnerType: string;
  bizNo?: string;
  ceoName?: string;
  address?: string;
  tel?: string;
  fax?: string;
  email?: string;
  contactPerson?: string;
  remark?: string;
  useYn: string;
}

const mockPartners: Partner[] = [
  { id: '1', partnerCode: 'SUP-001', partnerName: '대한전선', partnerType: 'SUPPLIER', bizNo: '123-45-67890', ceoName: '김대한', address: '서울시 강남구', tel: '02-1234-5678', contactPerson: '이담당', useYn: 'Y' },
  { id: '2', partnerCode: 'SUP-002', partnerName: '현대커넥터', partnerType: 'SUPPLIER', bizNo: '234-56-78901', ceoName: '박현대', address: '경기도 화성시', tel: '031-234-5678', email: 'info@hdconnector.co.kr', contactPerson: '최영업', useYn: 'Y' },
  { id: '3', partnerCode: 'SUP-003', partnerName: '삼성부품', partnerType: 'SUPPLIER', bizNo: '345-67-89012', ceoName: '이삼성', address: '경기도 수원시', tel: '031-345-6789', useYn: 'Y' },
  { id: '4', partnerCode: 'CUS-001', partnerName: '현대자동차', partnerType: 'CUSTOMER', bizNo: '456-78-90123', ceoName: '정몽구', address: '서울시 서초구', tel: '02-3456-7890', contactPerson: '강구매', useYn: 'Y' },
  { id: '5', partnerCode: 'CUS-002', partnerName: '기아자동차', partnerType: 'CUSTOMER', bizNo: '567-89-01234', ceoName: '송호성', address: '서울시 서초구', tel: '02-4567-8901', contactPerson: '윤조달', useYn: 'Y' },
  { id: '6', partnerCode: 'CUS-003', partnerName: 'GM코리아', partnerType: 'CUSTOMER', bizNo: '678-90-12345', ceoName: '카허카젬', address: '인천시 부평구', tel: '032-567-8901', useYn: 'N' },
];

const partnerTypeOptions = [
  { value: '', label: '전체' },
  { value: 'SUPPLIER', label: '공급상' },
  { value: 'CUSTOMER', label: '고객' },
];

const partnerTypeFormOptions = [
  { value: 'SUPPLIER', label: '공급상' },
  { value: 'CUSTOMER', label: '고객' },
];

function PartnerPage() {
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

  const filteredPartners = useMemo(() => {
    return mockPartners.filter((p) => {
      const matchSearch =
        !searchText ||
        p.partnerCode.toLowerCase().includes(searchText.toLowerCase()) ||
        p.partnerName.toLowerCase().includes(searchText.toLowerCase()) ||
        p.bizNo?.toLowerCase().includes(searchText.toLowerCase()) ||
        p.contactPerson?.toLowerCase().includes(searchText.toLowerCase());
      const matchType = !typeFilter || p.partnerType === typeFilter;
      return matchSearch && matchType;
    });
  }, [searchText, typeFilter]);

  const columns = useMemo<ColumnDef<Partner>[]>(
    () => [
      { accessorKey: 'partnerCode', header: '거래처코드', size: 120 },
      { accessorKey: 'partnerName', header: '거래처명', size: 150 },
      {
        accessorKey: 'partnerType',
        header: '유형',
        size: 80,
        cell: ({ getValue }) => {
          const typeMap: Record<string, { label: string; color: string }> = {
            SUPPLIER: { label: '공급상', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
            CUSTOMER: { label: '고객', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
          };
          const t = typeMap[getValue() as string] || { label: getValue(), color: 'bg-gray-100 text-gray-700' };
          return <span className={`px-2 py-1 text-xs rounded-full ${t.color}`}>{t.label}</span>;
        },
      },
      { accessorKey: 'bizNo', header: '사업자번호', size: 130 },
      { accessorKey: 'ceoName', header: '대표자', size: 90 },
      { accessorKey: 'tel', header: '전화번호', size: 130 },
      { accessorKey: 'contactPerson', header: '담당자', size: 90 },
      { accessorKey: 'email', header: '이메일', size: 180 },
      {
        accessorKey: 'useYn',
        header: '사용',
        size: 60,
        cell: ({ getValue }) => (
          <span className={`w-2 h-2 rounded-full inline-block ${getValue() === 'Y' ? 'bg-green-500' : 'bg-gray-400'}`} />
        ),
      },
      {
        id: 'actions',
        header: '관리',
        size: 80,
        cell: ({ row }) => (
          <div className="flex gap-1">
            <button
              onClick={() => { setEditingPartner(row.original); setIsModalOpen(true); }}
              className="p-1 hover:bg-surface rounded"
            >
              <Edit2 className="w-4 h-4 text-primary" />
            </button>
            <button className="p-1 hover:bg-surface rounded">
              <Trash2 className="w-4 h-4 text-red-500" />
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
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Building2 className="w-7 h-7 text-primary" />거래처 관리
          </h1>
          <p className="text-text-muted mt-1">공급상 및 고객 거래처 정보를 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <Download className="w-4 h-4 mr-1" /> 엑셀 다운로드
          </Button>
          <Button size="sm" onClick={() => { setEditingPartner(null); setIsModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> 거래처 추가
          </Button>
        </div>
      </div>

      <Card>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="거래처코드, 거래처명, 사업자번호, 담당자로 검색..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth
              />
            </div>
            <div className="w-40">
              <Select
                options={partnerTypeOptions}
                value={typeFilter}
                onChange={setTypeFilter}
                placeholder="거래처 유형"
                fullWidth
              />
            </div>
            <Button variant="secondary">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          <DataGrid
            data={filteredPartners}
            columns={columns}
            pageSize={10}
            onRowClick={(row) => console.log('Selected:', row)}
          />
        </CardContent>
      </Card>

      {/* 거래처 추가/수정 모달 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPartner ? '거래처 수정' : '거래처 추가'}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <Input label="거래처코드" placeholder="SUP-001" defaultValue={editingPartner?.partnerCode} fullWidth />
          <Select
            label="거래처유형"
            options={partnerTypeFormOptions}
            value={editingPartner?.partnerType || 'SUPPLIER'}
            onChange={() => {}}
            fullWidth
          />
          <div className="col-span-2">
            <Input label="거래처명" placeholder="대한전선" defaultValue={editingPartner?.partnerName} fullWidth />
          </div>
          <Input label="사업자번호" placeholder="123-45-67890" defaultValue={editingPartner?.bizNo} fullWidth />
          <Input label="대표자명" placeholder="홍길동" defaultValue={editingPartner?.ceoName} fullWidth />
          <div className="col-span-2">
            <Input label="주소" placeholder="서울시 강남구..." defaultValue={editingPartner?.address} fullWidth />
          </div>
          <Input label="전화번호" placeholder="02-1234-5678" defaultValue={editingPartner?.tel} fullWidth />
          <Input label="팩스번호" placeholder="02-1234-5679" defaultValue={editingPartner?.fax} fullWidth />
          <Input label="이메일" placeholder="contact@company.com" defaultValue={editingPartner?.email} fullWidth />
          <Input label="담당자명" placeholder="김담당" defaultValue={editingPartner?.contactPerson} fullWidth />
          <div className="col-span-2">
            <Input label="비고" placeholder="메모" defaultValue={editingPartner?.remark} fullWidth />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>취소</Button>
          <Button>{editingPartner ? '수정' : '추가'}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default PartnerPage;
