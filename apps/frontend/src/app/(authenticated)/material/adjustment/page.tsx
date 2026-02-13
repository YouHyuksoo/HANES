"use client";

/**
 * @file src/app/(authenticated)/material/adjustment/page.tsx
 * @description 재고보정 페이지 - 재고 수량 수동 보정
 *
 * 초보자 가이드:
 * 1. **보정**: 시스템 수량과 실제 수량 차이를 수동으로 조정
 * 2. **이력**: InvAdjLog에 보정 전후 수량과 사유 기록
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal, Search, RefreshCw, Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface AdjustmentRecord {
  id: string;
  warehouseCode: string;
  partCode: string;
  partName: string;
  adjType: string;
  beforeQty: number;
  afterQty: number;
  diffQty: number;
  reason: string;
  createdBy: string;
  createdAt: string;
}

const mockData: AdjustmentRecord[] = [
  { id: '1', warehouseCode: 'WH-A', partCode: 'WIRE-001', partName: 'AWG18 적색', adjType: 'INCREASE', beforeQty: 4500, afterQty: 5000, diffQty: 500, reason: '재고실사 반영', createdBy: '김관리', createdAt: '2026-02-01' },
  { id: '2', warehouseCode: 'WH-B', partCode: 'TERM-001', partName: '단자 110형', adjType: 'DECREASE', beforeQty: 12000, afterQty: 11500, diffQty: -500, reason: '수량 오차 보정', createdBy: '이관리', createdAt: '2026-02-05' },
  { id: '3', warehouseCode: 'WH-A', partCode: 'CONN-001', partName: '커넥터 6핀', adjType: 'INCREASE', beforeQty: 1800, afterQty: 2000, diffQty: 200, reason: '이전 미계상분 반영', createdBy: '김관리', createdAt: '2026-02-10' },
];

function AdjustmentPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredData = useMemo(() => {
    return mockData.filter(item => {
      if (!searchText) return true;
      const s = searchText.toLowerCase();
      return item.partCode.toLowerCase().includes(s) || item.partName.toLowerCase().includes(s) || item.reason.toLowerCase().includes(s);
    });
  }, [searchText]);

  const columns = useMemo<ColumnDef<AdjustmentRecord>[]>(() => [
    { accessorKey: 'warehouseCode', header: t('material.adjustment.warehouse'), size: 80 },
    { accessorKey: 'partCode', header: t('material.adjustment.partCode'), size: 100 },
    { accessorKey: 'partName', header: t('material.adjustment.partName'), size: 130 },
    { accessorKey: 'adjType', header: t('material.adjustment.adjType'), size: 80, cell: ({ getValue }) => {
      const type = getValue() as string;
      return type === 'INCREASE'
        ? <span className="flex items-center text-green-600"><TrendingUp className="w-4 h-4 mr-1" />{t('material.adjustment.increase')}</span>
        : <span className="flex items-center text-red-600"><TrendingDown className="w-4 h-4 mr-1" />{t('material.adjustment.decrease')}</span>;
    }},
    { accessorKey: 'beforeQty', header: t('material.adjustment.beforeQty'), size: 90 },
    { accessorKey: 'afterQty', header: t('material.adjustment.afterQty'), size: 90 },
    { accessorKey: 'diffQty', header: t('material.adjustment.diffQty'), size: 80, cell: ({ getValue }) => {
      const diff = getValue() as number;
      return <span className={diff >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{diff >= 0 ? '+' : ''}{diff}</span>;
    }},
    { accessorKey: 'reason', header: t('material.adjustment.reason'), size: 150 },
    { accessorKey: 'createdBy', header: t('material.adjustment.createdBy'), size: 80 },
    { accessorKey: 'createdAt', header: t('material.adjustment.createdAt'), size: 100 },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><SlidersHorizontal className="w-7 h-7 text-primary" />{t('material.adjustment.title')}</h1>
          <p className="text-text-muted mt-1">{t('material.adjustment.subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => setIsModalOpen(true)}><Plus className="w-4 h-4 mr-1" />{t('material.adjustment.register')}</Button>
      </div>
      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder={t('material.adjustment.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('material.adjustment.register')} size="md">
        <div className="grid grid-cols-2 gap-4">
          <Input label={t('material.adjustment.warehouse')} placeholder={t('material.adjustment.warehouse')} fullWidth />
          <Input label={t('material.adjustment.partCode')} placeholder={t('material.adjustment.partCode')} fullWidth />
          <Input label={t('material.adjustment.afterQty')} type="number" placeholder="0" fullWidth />
          <div className="col-span-2"><Input label={t('material.adjustment.reason')} placeholder={t('material.adjustment.reasonPlaceholder')} fullWidth /></div>
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
          <Button>{t('material.adjustment.register')}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default AdjustmentPage;
