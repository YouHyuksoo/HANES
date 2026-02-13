"use client";

/**
 * @file src/app/(authenticated)/material/lot-split/page.tsx
 * @description 자재분할 페이지 - LOT 분할 관리
 *
 * 초보자 가이드:
 * 1. **LOT 분할**: 하나의 LOT에서 일부 수량을 분리하여 새 LOT 생성
 * 2. **추적성**: 분할 후에도 parentLotId로 추적 가능
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Scissors, Search, RefreshCw, GitBranch } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface SplittableLot {
  id: string;
  lotNo: string;
  partCode: string;
  partName: string;
  currentQty: number;
  unit: string;
  vendor: string;
  status: string;
}

const mockData: SplittableLot[] = [
  { id: '1', lotNo: 'L20260201-A01', partCode: 'WIRE-001', partName: 'AWG18 적색', currentQty: 5000, unit: 'M', vendor: '대한전선', status: 'NORMAL' },
  { id: '2', lotNo: 'L20260201-B01', partCode: 'TERM-001', partName: '단자 110형', currentQty: 10000, unit: 'EA', vendor: '한국단자', status: 'NORMAL' },
  { id: '3', lotNo: 'L20260203-A01', partCode: 'CONN-001', partName: '커넥터 6핀', currentQty: 2000, unit: 'EA', vendor: '삼성커넥터', status: 'NORMAL' },
  { id: '4', lotNo: 'L20260205-B01', partCode: 'WIRE-002', partName: 'AWG20 흑색', currentQty: 3000, unit: 'M', vendor: '대한전선', status: 'NORMAL' },
];

function LotSplitPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLot, setSelectedLot] = useState<SplittableLot | null>(null);

  const filteredData = useMemo(() => {
    return mockData.filter(item => {
      if (!searchText) return true;
      const s = searchText.toLowerCase();
      return item.lotNo.toLowerCase().includes(s) || item.partName.toLowerCase().includes(s);
    });
  }, [searchText]);

  const columns = useMemo<ColumnDef<SplittableLot>[]>(() => [
    { accessorKey: 'lotNo', header: 'LOT No.', size: 160 },
    { accessorKey: 'partCode', header: t('material.lotSplit.partCode'), size: 110 },
    { accessorKey: 'partName', header: t('material.lotSplit.partName'), size: 130 },
    { accessorKey: 'currentQty', header: t('material.lotSplit.currentQty'), size: 120, cell: ({ row }) => <span className="font-semibold">{row.original.currentQty.toLocaleString()} {row.original.unit}</span> },
    { accessorKey: 'vendor', header: t('material.lotSplit.vendor'), size: 100 },
    { id: 'actions', header: '', size: 80, cell: ({ row }) => (
      <Button size="sm" variant="secondary" onClick={() => { setSelectedLot(row.original); setIsModalOpen(true); }}>
        <Scissors className="w-4 h-4 mr-1" />{t('material.lotSplit.split')}
      </Button>
    )},
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><GitBranch className="w-7 h-7 text-primary" />{t('material.lotSplit.title')}</h1>
          <p className="text-text-muted mt-1">{t('material.lotSplit.subtitle')}</p>
        </div>
        <Button variant="secondary" size="sm"><RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}</Button>
      </div>
      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder={t('material.lotSplit.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('material.lotSplit.splitTitle')} size="md">
        {selectedLot && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between border-b border-border pb-2"><span className="text-text-muted">LOT No.</span><span className="font-medium">{selectedLot.lotNo}</span></div>
              <div className="flex justify-between border-b border-border pb-2"><span className="text-text-muted">{t('material.lotSplit.currentQty')}</span><span className="font-semibold">{selectedLot.currentQty.toLocaleString()} {selectedLot.unit}</span></div>
            </div>
            <Input label={t('material.lotSplit.splitQty')} type="number" placeholder="0" fullWidth />
            <Input label={t('material.lotSplit.newLotNo')} placeholder={t('material.lotSplit.newLotNoPlaceholder')} fullWidth />
            <Input label={t('material.lotSplit.remark')} placeholder={t('material.lotSplit.remarkPlaceholder')} fullWidth />
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
              <Button><Scissors className="w-4 h-4 mr-1" />{t('material.lotSplit.split')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default LotSplitPage;
