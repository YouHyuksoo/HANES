"use client";

/**
 * @file src/app/(authenticated)/master/transfer-rule/page.tsx
 * @description 창고이동규칙 관리 페이지 - 창고 간 이동 허용 규칙 관리
 *
 * 초보자 가이드:
 * 1. **규칙 목록**: 출발창고 -> 도착창고 이동 허용 여부 관리
 * 2. **창고 필터**: 출발/도착 창고별 필터링
 * 3. **규칙 등록/수정**: 모달로 CRUD 처리
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, Search, RefreshCw, Download, ArrowRightLeft } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface TransferRule {
  id: string;
  fromWarehouseCode: string;
  fromWarehouseName: string;
  toWarehouseCode: string;
  toWarehouseName: string;
  allowYn: string;
  remark?: string;
}

const mockData: TransferRule[] = [
  { id: '1', fromWarehouseCode: 'WH-RAW', fromWarehouseName: '원자재 창고', toWarehouseCode: 'WH-LINE1', toWarehouseName: 'L1 공정재공', allowYn: 'Y' },
  { id: '2', fromWarehouseCode: 'WH-RAW', fromWarehouseName: '원자재 창고', toWarehouseCode: 'WH-LINE2', toWarehouseName: 'L2 공정재공', allowYn: 'Y' },
  { id: '3', fromWarehouseCode: 'WH-LINE1', fromWarehouseName: 'L1 공정재공', toWarehouseCode: 'WH-FG', toWarehouseName: '완제품 창고', allowYn: 'Y' },
  { id: '4', fromWarehouseCode: 'WH-FG', fromWarehouseName: '완제품 창고', toWarehouseCode: 'WH-SHIP', toWarehouseName: '출하 창고', allowYn: 'Y' },
  { id: '5', fromWarehouseCode: 'WH-FG', fromWarehouseName: '완제품 창고', toWarehouseCode: 'WH-RAW', toWarehouseName: '원자재 창고', allowYn: 'N', remark: '역방향 이동 금지' },
  { id: '6', fromWarehouseCode: 'WH-DEFECT', fromWarehouseName: '불량 창고', toWarehouseCode: 'WH-SCRAP', toWarehouseName: '폐기 창고', allowYn: 'Y' },
];

function TransferRulePage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TransferRule | null>(null);

  const warehouseOptions = [
    { value: 'WH-RAW', label: 'WH-RAW 원자재 창고' },
    { value: 'WH-LINE1', label: 'WH-LINE1 L1 공정재공' },
    { value: 'WH-LINE2', label: 'WH-LINE2 L2 공정재공' },
    { value: 'WH-FG', label: 'WH-FG 완제품 창고' },
    { value: 'WH-SHIP', label: 'WH-SHIP 출하 창고' },
    { value: 'WH-DEFECT', label: 'WH-DEFECT 불량 창고' },
    { value: 'WH-SCRAP', label: 'WH-SCRAP 폐기 창고' },
  ];

  const filteredData = useMemo(() => mockData.filter(item => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return item.fromWarehouseCode.toLowerCase().includes(s) || item.fromWarehouseName.toLowerCase().includes(s) ||
      item.toWarehouseCode.toLowerCase().includes(s) || item.toWarehouseName.toLowerCase().includes(s);
  }), [searchText]);

  const columns = useMemo<ColumnDef<TransferRule>[]>(() => [
    { accessorKey: 'fromWarehouseCode', header: t('master.transferRule.fromWarehouseCode'), size: 120 },
    { accessorKey: 'fromWarehouseName', header: t('master.transferRule.fromWarehouseName'), size: 140 },
    { id: 'arrow', header: '', size: 40, cell: () => <ArrowRightLeft className="w-4 h-4 text-text-muted mx-auto" /> },
    { accessorKey: 'toWarehouseCode', header: t('master.transferRule.toWarehouseCode'), size: 120 },
    { accessorKey: 'toWarehouseName', header: t('master.transferRule.toWarehouseName'), size: 140 },
    { accessorKey: 'allowYn', header: t('master.transferRule.allow'), size: 70, cell: ({ getValue }) => (
      <span className={`px-2 py-1 text-xs rounded-full ${getValue() === 'Y' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
        {getValue() === 'Y' ? t('master.transferRule.allowed') : t('master.transferRule.denied')}
      </span>
    )},
    { accessorKey: 'remark', header: t('common.remark'), size: 150, cell: ({ getValue }) => getValue() || '-' },
    { id: 'actions', header: t('common.actions'), size: 80, cell: ({ row }) => (
      <div className="flex gap-1">
        <button onClick={() => { setEditingItem(row.original); setIsModalOpen(true); }} className="p-1 hover:bg-surface rounded"><Edit2 className="w-4 h-4 text-primary" /></button>
        <button className="p-1 hover:bg-surface rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
      </div>
    )},
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><ArrowRightLeft className="w-7 h-7 text-primary" />{t('master.transferRule.title')}</h1>
          <p className="text-text-muted mt-1">{t('master.transferRule.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />{t('common.excel')}</Button>
          <Button size="sm" onClick={() => { setEditingItem(null); setIsModalOpen(true); }}><Plus className="w-4 h-4 mr-1" />{t('master.transferRule.addRule')}</Button>
        </div>
      </div>
      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder={t('master.transferRule.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? t('master.transferRule.editRule') : t('master.transferRule.addRule')} size="md">
        <div className="grid grid-cols-2 gap-4">
          <Select label={t('master.transferRule.fromWarehouse')} options={warehouseOptions} value={editingItem?.fromWarehouseCode || ''} onChange={() => {}} fullWidth />
          <Select label={t('master.transferRule.toWarehouse')} options={warehouseOptions} value={editingItem?.toWarehouseCode || ''} onChange={() => {}} fullWidth />
          <Select label={t('master.transferRule.allowYn')} options={[{ value: 'Y', label: t('master.transferRule.allowed') }, { value: 'N', label: t('master.transferRule.denied') }]} value={editingItem?.allowYn || 'Y'} onChange={() => {}} fullWidth />
          <Input label={t('common.remark')} placeholder={t('common.remark')} defaultValue={editingItem?.remark} fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
          <Button>{editingItem ? t('common.edit') : t('common.add')}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default TransferRulePage;
