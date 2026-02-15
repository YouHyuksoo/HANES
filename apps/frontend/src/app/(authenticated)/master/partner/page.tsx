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
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, Search, RefreshCw, Download, Building2 } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select, ComCodeBadge } from '@/components/ui';
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

function PartnerPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

  const partnerTypeOptions = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'SUPPLIER', label: t('master.partner.supplier') },
    { value: 'CUSTOMER', label: t('master.partner.customer') },
  ], [t]);

  const partnerTypeFormOptions = useMemo(() => [
    { value: 'SUPPLIER', label: t('master.partner.supplier') },
    { value: 'CUSTOMER', label: t('master.partner.customer') },
  ], [t]);

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
      { accessorKey: 'partnerCode', header: t('master.partner.partnerCode'), size: 120 },
      { accessorKey: 'partnerName', header: t('master.partner.partnerName'), size: 150 },
      {
        accessorKey: 'partnerType',
        header: t('master.partner.type'),
        size: 80,
        cell: ({ getValue }) => (
          <ComCodeBadge groupCode="PARTNER_TYPE" code={getValue() as string} />
        ),
      },
      { accessorKey: 'bizNo', header: t('master.partner.bizNo'), size: 130 },
      { accessorKey: 'ceoName', header: t('master.partner.ceoName'), size: 90 },
      { accessorKey: 'tel', header: t('master.partner.tel'), size: 130 },
      { accessorKey: 'contactPerson', header: t('master.partner.contactPerson'), size: 90 },
      { accessorKey: 'email', header: t('master.partner.email'), size: 180 },
      {
        accessorKey: 'useYn',
        header: t('master.partner.use'),
        size: 60,
        cell: ({ getValue }) => (
          <span className={`w-2 h-2 rounded-full inline-block ${getValue() === 'Y' ? 'bg-green-500' : 'bg-gray-400'}`} />
        ),
      },
      {
        id: 'actions',
        header: t('common.actions'),
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
    [t]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Building2 className="w-7 h-7 text-primary" />{t('master.partner.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('master.partner.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <Download className="w-4 h-4 mr-1" /> {t('common.excel')}
          </Button>
          <Button size="sm" onClick={() => { setEditingPartner(null); setIsModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> {t('master.partner.addPartner')}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder={t('master.partner.searchPlaceholder')}
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
                placeholder={t('master.partner.type')}
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
        title={editingPartner ? t('master.partner.editPartner') : t('master.partner.addPartner')}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <Input label={t('master.partner.partnerCode')} placeholder="SUP-001" defaultValue={editingPartner?.partnerCode} fullWidth />
          <Select
            label={t('master.partner.type')}
            options={partnerTypeFormOptions}
            value={editingPartner?.partnerType || 'SUPPLIER'}
            onChange={() => {}}
            fullWidth
          />
          <div className="col-span-2">
            <Input label={t('master.partner.partnerName')} placeholder={t('master.partner.partnerName')} defaultValue={editingPartner?.partnerName} fullWidth />
          </div>
          <Input label={t('master.partner.bizNo')} placeholder="123-45-67890" defaultValue={editingPartner?.bizNo} fullWidth />
          <Input label={t('master.partner.ceoName')} placeholder={t('master.partner.ceoName')} defaultValue={editingPartner?.ceoName} fullWidth />
          <div className="col-span-2">
            <Input label={t('master.partner.address')} placeholder={t('master.partner.addressPlaceholder')} defaultValue={editingPartner?.address} fullWidth />
          </div>
          <Input label={t('master.partner.tel')} placeholder="02-1234-5678" defaultValue={editingPartner?.tel} fullWidth />
          <Input label={t('master.partner.fax')} placeholder="02-1234-5679" defaultValue={editingPartner?.fax} fullWidth />
          <Input label={t('master.partner.email')} placeholder="contact@company.com" defaultValue={editingPartner?.email} fullWidth />
          <Input label={t('master.partner.contactPerson')} placeholder={t('master.partner.contactPerson')} defaultValue={editingPartner?.contactPerson} fullWidth />
          <div className="col-span-2">
            <Input label={t('master.partner.remark')} placeholder={t('master.partner.remarkPlaceholder')} defaultValue={editingPartner?.remark} fullWidth />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
          <Button>{editingPartner ? t('common.edit') : t('common.add')}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default PartnerPage;
