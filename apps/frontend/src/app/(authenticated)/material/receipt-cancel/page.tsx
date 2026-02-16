"use client";

/**
 * @file src/app/(authenticated)/material/receipt-cancel/page.tsx
 * @description 입고취소 페이지 - 입고 트랜잭션 역분개 처리
 *
 * 초보자 가이드:
 * 1. **역분개**: 원래 입고의 반대 트랜잭션을 생성하여 입고 취소
 * 2. **취소 가능**: DONE 상태인 MAT_IN, MISC_IN 유형만 취소 가능
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, Search, RefreshCw, XCircle } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { createPartColumns } from '@/lib/table-utils';
import { ColumnDef } from '@tanstack/react-table';

interface ReceiptTransaction {
  id: string;
  transNo: string;
  transType: string;
  partCode: string;
  partName: string;
  lotNo: string;
  warehouseName: string;
  qty: number;
  unit: string;
  transDate: string;
  status: string;
}

const mockData: ReceiptTransaction[] = [
  { id: '1', transNo: 'MAT-IN-001', transType: 'MAT_IN', partCode: 'WIRE-001', partName: 'AWG18 적색', lotNo: 'L20260201-A01', warehouseName: '자재창고A', qty: 5000, unit: 'M', transDate: '2026-02-01', status: 'DONE' },
  { id: '2', transNo: 'MAT-IN-002', transType: 'MAT_IN', partCode: 'TERM-001', partName: '단자 110형', lotNo: 'L20260201-B01', warehouseName: '자재창고B', qty: 10000, unit: 'EA', transDate: '2026-02-01', status: 'DONE' },
  { id: '3', transNo: 'MISC-001', transType: 'MISC_IN', partCode: 'CONN-001', partName: '커넥터 6핀', lotNo: 'L20260203-A01', warehouseName: '자재창고A', qty: 500, unit: 'EA', transDate: '2026-02-03', status: 'DONE' },
  { id: '4', transNo: 'MAT-IN-003', transType: 'MAT_IN', partCode: 'WIRE-002', partName: 'AWG20 흑색', lotNo: 'L20260205-B01', warehouseName: '자재창고A', qty: 3000, unit: 'M', transDate: '2026-02-05', status: 'CANCELED' },
];

const statusColors: Record<string, string> = {
  DONE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  CANCELED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

function ReceiptCancelPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<ReceiptTransaction | null>(null);

  const filteredData = useMemo(() => {
    return mockData.filter(item => {
      if (!searchText) return true;
      const s = searchText.toLowerCase();
      return item.transNo.toLowerCase().includes(s) || item.partName.toLowerCase().includes(s) || item.lotNo.toLowerCase().includes(s);
    });
  }, [searchText]);

  const columns = useMemo<ColumnDef<ReceiptTransaction>[]>(() => [
    { accessorKey: 'transNo', header: t('material.receiptCancel.transNo'), size: 140 },
    { accessorKey: 'transType', header: t('material.receiptCancel.transType'), size: 80, cell: ({ getValue }) => <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">{getValue() as string}</span> },
    ...createPartColumns<ReceiptTransaction>(t),
    { accessorKey: 'lotNo', header: 'LOT No.', size: 150 },
    { accessorKey: 'warehouseName', header: t('material.receiptCancel.warehouse'), size: 100 },
    { accessorKey: 'qty', header: t('material.receiptCancel.qty'), size: 100, cell: ({ row }) => <span className="font-medium">{row.original.qty.toLocaleString()} {row.original.unit}</span> },
    { accessorKey: 'transDate', header: t('material.receiptCancel.transDate'), size: 100 },
    { accessorKey: 'status', header: t('common.status'), size: 80, cell: ({ getValue }) => {
      const s = getValue() as string;
      return <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[s] || ''}`}>{s}</span>;
    }},
    { id: 'actions', header: '', size: 80, cell: ({ row }) => {
      if (row.original.status === 'CANCELED') return null;
      return (
        <Button size="sm" variant="secondary" onClick={() => { setSelectedTx(row.original); setIsModalOpen(true); }}>
          <XCircle className="w-4 h-4 mr-1" />{t('material.receiptCancel.cancel')}
        </Button>
      );
    }},
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><RotateCcw className="w-7 h-7 text-primary" />{t('material.receiptCancel.title')}</h1>
          <p className="text-text-muted mt-1">{t('material.receiptCancel.subtitle')}</p>
        </div>
        <Button variant="secondary" size="sm"><RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}</Button>
      </div>
      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder={t('material.receiptCancel.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('material.receiptCancel.cancelTitle')} size="sm">
        {selectedTx && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between border-b border-border pb-2"><span className="text-text-muted">{t('material.receiptCancel.transNo')}</span><span className="font-medium">{selectedTx.transNo}</span></div>
              <div className="flex justify-between border-b border-border pb-2"><span className="text-text-muted">{t('material.receiptCancel.qty')}</span><span className="font-medium">{selectedTx.qty.toLocaleString()} {selectedTx.unit}</span></div>
            </div>
            <Input label={t('material.receiptCancel.reason')} placeholder={t('material.receiptCancel.reasonPlaceholder')} fullWidth />
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
              <Button variant="primary"><XCircle className="w-4 h-4 mr-1" />{t('material.receiptCancel.confirm')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default ReceiptCancelPage;
