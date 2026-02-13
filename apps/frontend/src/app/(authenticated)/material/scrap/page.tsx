"use client";

/**
 * @file src/app/(authenticated)/material/scrap/page.tsx
 * @description 자재폐기 페이지 - 불량/만료 자재 폐기 처리
 *
 * 초보자 가이드:
 * 1. **폐기**: LOT에서 수량을 차감하고 StockTransaction(SCRAP) 기록
 * 2. **사유 필수**: 폐기 시 반드시 사유 입력
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash, Search, RefreshCw, Plus } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface ScrapRecord {
  id: string;
  transNo: string;
  lotNo: string;
  partCode: string;
  partName: string;
  qty: number;
  unit: string;
  reason: string;
  transDate: string;
}

const mockData: ScrapRecord[] = [
  { id: '1', transNo: 'SCR-001', lotNo: 'L20260101-A01', partCode: 'CHEM-001', partName: '접착제 A형', qty: 50, unit: 'KG', reason: '유효기한 만료', transDate: '2026-02-01' },
  { id: '2', transNo: 'SCR-002', lotNo: 'L20260110-B01', partCode: 'WIRE-003', partName: 'AWG22 백색', qty: 200, unit: 'M', reason: '품질 불량', transDate: '2026-02-05' },
  { id: '3', transNo: 'SCR-003', lotNo: 'L20260115-C01', partCode: 'SEAL-001', partName: '실리콘 패킹', qty: 100, unit: 'EA', reason: '파손', transDate: '2026-02-10' },
];

function ScrapPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredData = useMemo(() => {
    return mockData.filter(item => {
      if (!searchText) return true;
      const s = searchText.toLowerCase();
      return item.transNo.toLowerCase().includes(s) || item.lotNo.toLowerCase().includes(s) || item.partName.toLowerCase().includes(s);
    });
  }, [searchText]);

  const columns = useMemo<ColumnDef<ScrapRecord>[]>(() => [
    { accessorKey: 'transNo', header: t('material.scrap.transNo'), size: 120 },
    { accessorKey: 'lotNo', header: 'LOT No.', size: 160 },
    { accessorKey: 'partCode', header: t('material.scrap.partCode'), size: 100 },
    { accessorKey: 'partName', header: t('material.scrap.partName'), size: 130 },
    { accessorKey: 'qty', header: t('material.scrap.qty'), size: 100, cell: ({ row }) => <span className="text-red-600 font-medium">-{row.original.qty.toLocaleString()} {row.original.unit}</span> },
    { accessorKey: 'reason', header: t('material.scrap.reason'), size: 150 },
    { accessorKey: 'transDate', header: t('material.scrap.transDate'), size: 110 },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Trash className="w-7 h-7 text-primary" />{t('material.scrap.title')}</h1>
          <p className="text-text-muted mt-1">{t('material.scrap.subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => setIsModalOpen(true)}><Plus className="w-4 h-4 mr-1" />{t('material.scrap.register')}</Button>
      </div>
      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder={t('material.scrap.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('material.scrap.register')} size="md">
        <div className="grid grid-cols-2 gap-4">
          <Input label="LOT ID" placeholder="LOT ID" fullWidth />
          <Input label={t('material.scrap.warehouse')} placeholder={t('material.scrap.warehouse')} fullWidth />
          <Input label={t('material.scrap.qty')} type="number" placeholder="0" fullWidth />
          <div className="col-span-2"><Input label={t('material.scrap.reason')} placeholder={t('material.scrap.reasonPlaceholder')} fullWidth /></div>
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
          <Button>{t('material.scrap.register')}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default ScrapPage;
