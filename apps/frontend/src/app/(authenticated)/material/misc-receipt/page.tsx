"use client";

/**
 * @file src/app/(authenticated)/material/misc-receipt/page.tsx
 * @description 기타입고 페이지 - PO 없는 기타 사유 입고 처리
 *
 * 초보자 가이드:
 * 1. **기타입고**: 정규 발주 외 입고 (반품, 무상공급, 테스트용 등)
 * 2. **StockTransaction**: MISC_IN 유형으로 기록
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PackagePlus, Search, RefreshCw, Plus } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { createPartColumns } from '@/lib/table-utils';

interface MiscReceiptRecord {
  id: string;
  transNo: string;
  partCode: string;
  partName: string;
  warehouseName: string;
  qty: number;
  unit: string;
  remark: string;
  transDate: string;
}

const mockData: MiscReceiptRecord[] = [
  { id: '1', transNo: 'MISC-001', partCode: 'WIRE-001', partName: 'AWG18 적색', warehouseName: '자재창고A', qty: 500, unit: 'M', remark: '무상 보충', transDate: '2026-02-03' },
  { id: '2', transNo: 'MISC-002', partCode: 'TERM-001', partName: '단자 110형', warehouseName: '자재창고B', qty: 2000, unit: 'EA', remark: '테스트용 입고', transDate: '2026-02-07' },
  { id: '3', transNo: 'MISC-003', partCode: 'CONN-001', partName: '커넥터 6핀', warehouseName: '자재창고A', qty: 100, unit: 'EA', remark: '반품 입고', transDate: '2026-02-12' },
];

function MiscReceiptPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredData = useMemo(() => {
    return mockData.filter(item => {
      if (!searchText) return true;
      const s = searchText.toLowerCase();
      return item.transNo.toLowerCase().includes(s) || item.partName.toLowerCase().includes(s) || item.remark.toLowerCase().includes(s);
    });
  }, [searchText]);

  const columns = useMemo<ColumnDef<MiscReceiptRecord>[]>(() => [
    { accessorKey: 'transNo', header: t('material.miscReceipt.transNo'), size: 120 },
    ...createPartColumns<MiscReceiptRecord>(t),
    { accessorKey: 'warehouseName', header: t('material.miscReceipt.warehouse'), size: 110 },
    { accessorKey: 'qty', header: t('material.miscReceipt.qty'), size: 100, cell: ({ row }) => <span className="text-green-600 font-medium">+{row.original.qty.toLocaleString()} {row.original.unit}</span> },
    { accessorKey: 'remark', header: t('material.miscReceipt.remark'), size: 150 },
    { accessorKey: 'transDate', header: t('material.miscReceipt.transDate'), size: 110 },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><PackagePlus className="w-7 h-7 text-primary" />{t('material.miscReceipt.title')}</h1>
          <p className="text-text-muted mt-1">{t('material.miscReceipt.subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => setIsModalOpen(true)}><Plus className="w-4 h-4 mr-1" />{t('material.miscReceipt.register')}</Button>
      </div>
      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder={t('material.miscReceipt.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('material.miscReceipt.register')} size="md">
        <div className="grid grid-cols-2 gap-4">
          <Input label={t('material.miscReceipt.warehouse')} placeholder={t('material.miscReceipt.warehouse')} fullWidth />
          <Input label={t('material.miscReceipt.partCode')} placeholder={t('material.miscReceipt.partCode')} fullWidth />
          <Input label={t('material.miscReceipt.qty')} type="number" placeholder="0" fullWidth />
          <div className="col-span-2"><Input label={t('material.miscReceipt.remark')} placeholder={t('material.miscReceipt.remarkPlaceholder')} fullWidth /></div>
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
          <Button>{t('material.miscReceipt.register')}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default MiscReceiptPage;
