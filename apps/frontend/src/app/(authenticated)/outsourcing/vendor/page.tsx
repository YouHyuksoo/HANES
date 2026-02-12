"use client";

/**
 * @file src/pages/outsourcing/VendorPage.tsx
 * @description 외주처 관리 페이지
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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

function VendorPage() {
  const { t } = useTranslation();

  const vendorTypeLabels: Record<string, string> = {
    SUBCON: t('outsourcing.vendor.typeSubcon'),
    SUPPLIER: t('outsourcing.vendor.typeSupplier'),
  };
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
      { accessorKey: 'vendorCode', header: t('outsourcing.vendor.vendorCode'), size: 100 },
      { accessorKey: 'vendorName', header: t('outsourcing.vendor.vendorName'), size: 150 },
      {
        accessorKey: 'vendorType',
        header: t('outsourcing.vendor.type'),
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
      { accessorKey: 'bizNo', header: t('outsourcing.vendor.bizNo'), size: 120 },
      { accessorKey: 'ceoName', header: t('outsourcing.vendor.ceoName'), size: 80 },
      { accessorKey: 'contactPerson', header: t('outsourcing.vendor.contactPerson'), size: 80 },
      { accessorKey: 'tel', header: t('outsourcing.vendor.tel'), size: 120 },
      { accessorKey: 'address', header: t('outsourcing.vendor.address'), size: 180 },
      {
        accessorKey: 'useYn',
        header: t('outsourcing.vendor.useYn'),
        size: 60,
        cell: ({ getValue }) => (
          <span className={getValue() === 'Y' ? 'text-green-600' : 'text-gray-400'}>
            {getValue() === 'Y' ? '●' : '○'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('common.manage'),
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
    [t]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Building2 className="w-7 h-7 text-primary" />{t('outsourcing.vendor.title')}</h1>
          <p className="text-text-muted mt-1">{t('outsourcing.vendor.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" /> {t('common.refresh')}
          </Button>
          <Button size="sm" onClick={() => { setSelectedItem(null); setIsModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> {t('outsourcing.vendor.register')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label={t('outsourcing.vendor.totalVendors')} value={mockData.length} icon={Building2} color="blue" />
        <StatCard label={t('outsourcing.vendor.typeSubcon')} value={mockData.filter((d) => d.vendorType === 'SUBCON').length} icon={Building2} color="blue" />
        <StatCard label={t('outsourcing.vendor.typeSupplier')} value={mockData.filter((d) => d.vendorType === 'SUPPLIER').length} icon={Building2} color="green" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder={t('outsourcing.vendor.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
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
        title={selectedItem ? t('outsourcing.vendor.editVendor') : t('outsourcing.vendor.register')}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <Input label={t('outsourcing.vendor.vendorCode')} placeholder="VND-001" defaultValue={selectedItem?.vendorCode} fullWidth />
          <Select
            label={t('outsourcing.vendor.type')}
            options={[
              { value: 'SUBCON', label: t('outsourcing.vendor.typeSubcon') },
              { value: 'SUPPLIER', label: t('outsourcing.vendor.typeSupplier') },
            ]}
            defaultValue={selectedItem?.vendorType || 'SUBCON'}
            fullWidth
          />
          <Input label={t('outsourcing.vendor.vendorName')} placeholder="(주)하네스파트너" defaultValue={selectedItem?.vendorName} fullWidth className="col-span-2" />
          <Input label={t('outsourcing.vendor.bizNo')} placeholder="123-45-67890" defaultValue={selectedItem?.bizNo} fullWidth />
          <Input label={t('outsourcing.vendor.ceoName')} placeholder="김대표" defaultValue={selectedItem?.ceoName} fullWidth />
          <Input label={t('outsourcing.vendor.tel')} placeholder="02-1234-5678" defaultValue={selectedItem?.tel} fullWidth />
          <Input label={t('outsourcing.vendor.fax')} placeholder="02-1234-5679" fullWidth />
          <Input label={t('outsourcing.vendor.email')} placeholder="contact@example.com" defaultValue={selectedItem?.email} fullWidth />
          <Input label={t('outsourcing.vendor.contactPerson')} placeholder="이담당" defaultValue={selectedItem?.contactPerson} fullWidth />
          <Input label={t('outsourcing.vendor.address')} placeholder="경기도 안산시 단원구" defaultValue={selectedItem?.address} fullWidth className="col-span-2" />
        </div>
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
          <Button>{selectedItem ? t('common.edit') : t('common.register')}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default VendorPage;
