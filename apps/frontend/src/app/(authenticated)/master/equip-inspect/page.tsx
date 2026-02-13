"use client";

/**
 * @file src/app/(authenticated)/master/equip-inspect/page.tsx
 * @description 설비점검항목 관리 페이지 - 설비별 일상/정기 점검 기준 관리
 *
 * 초보자 가이드:
 * 1. **점검항목 목록**: 설비별 점검항목 DataGrid 표시
 * 2. **설비/유형 필터**: 설비 선택 및 일상/정기 필터링
 * 3. **점검항목 등록/수정**: 모달로 CRUD 처리
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, Search, RefreshCw, Download, Wrench } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface EquipInspectItem {
  id: string;
  equipCode: string;
  equipName: string;
  inspectType: string;
  seq: number;
  itemName: string;
  criteria?: string;
  cycle?: string;
  useYn: string;
}

const mockData: EquipInspectItem[] = [
  { id: '1', equipCode: 'CUT-001', equipName: '절단기 1호', inspectType: 'DAILY', seq: 1, itemName: '블레이드 마모 확인', criteria: '마모선 이하', cycle: 'DAILY', useYn: 'Y' },
  { id: '2', equipCode: 'CUT-001', equipName: '절단기 1호', inspectType: 'DAILY', seq: 2, itemName: '에어압력 확인', criteria: '0.5~0.7 MPa', cycle: 'DAILY', useYn: 'Y' },
  { id: '3', equipCode: 'CRM-001', equipName: '압착기 1호', inspectType: 'DAILY', seq: 1, itemName: '압착높이 확인', criteria: '기준치 +/-0.05mm', cycle: 'DAILY', useYn: 'Y' },
  { id: '4', equipCode: 'CRM-001', equipName: '압착기 1호', inspectType: 'PERIODIC', seq: 1, itemName: '유압 오일 교환', criteria: '3000시간 또는 6개월', cycle: 'MONTHLY', useYn: 'Y' },
  { id: '5', equipCode: 'INSP-01', equipName: '통전검사기 1호', inspectType: 'DAILY', seq: 1, itemName: '접촉핀 상태', criteria: '변형/마모 없을것', cycle: 'DAILY', useYn: 'Y' },
  { id: '6', equipCode: 'INSP-01', equipName: '통전검사기 1호', inspectType: 'PERIODIC', seq: 1, itemName: '캘리브레이션', criteria: '기준 저항값 검증', cycle: 'MONTHLY', useYn: 'Y' },
];

const inspectTypeColorMap: Record<string, string> = {
  DAILY: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  PERIODIC: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
};

function EquipInspectPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipInspectItem | null>(null);

  const typeOptions = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'DAILY', label: t('master.equipInspect.typeDaily') },
    { value: 'PERIODIC', label: t('master.equipInspect.typePeriodic') },
  ], [t]);

  const cycleOptions = useMemo(() => [
    { value: 'DAILY', label: t('master.equipInspect.cycleDaily') }, { value: 'WEEKLY', label: t('master.equipInspect.cycleWeekly') }, { value: 'MONTHLY', label: t('master.equipInspect.cycleMonthly') },
  ], [t]);

  const filteredData = useMemo(() => mockData.filter(item => {
    if (typeFilter && item.inspectType !== typeFilter) return false;
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return item.equipCode.toLowerCase().includes(s) || item.itemName.toLowerCase().includes(s);
  }), [searchText, typeFilter]);

  const inspectTypeLabels: Record<string, string> = useMemo(() => ({
    DAILY: t('master.equipInspect.typeDaily'), PERIODIC: t('master.equipInspect.typePeriodic'),
  }), [t]);

  const columns = useMemo<ColumnDef<EquipInspectItem>[]>(() => [
    { accessorKey: 'equipCode', header: t('master.equipInspect.equipCode'), size: 100 },
    { accessorKey: 'equipName', header: t('master.equipInspect.equipName'), size: 130 },
    { accessorKey: 'inspectType', header: t('master.equipInspect.inspectType'), size: 100, cell: ({ getValue }) => {
      const val = getValue() as string;
      const color = inspectTypeColorMap[val];
      const label = inspectTypeLabels[val];
      return color ? <span className={`px-2 py-1 text-xs rounded-full ${color}`}>{label}</span> : getValue();
    }},
    { accessorKey: 'seq', header: t('master.equipInspect.seq'), size: 60 },
    { accessorKey: 'itemName', header: t('master.equipInspect.itemName'), size: 180 },
    { accessorKey: 'criteria', header: t('master.equipInspect.criteria'), size: 180 },
    { accessorKey: 'cycle', header: t('master.equipInspect.cycle'), size: 80 },
    { accessorKey: 'useYn', header: t('master.equipInspect.use'), size: 60, cell: ({ getValue }) => (
      <span className={`w-2 h-2 rounded-full inline-block ${getValue() === 'Y' ? 'bg-green-500' : 'bg-gray-400'}`} />
    )},
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
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Wrench className="w-7 h-7 text-primary" />{t('master.equipInspect.title')}</h1>
          <p className="text-text-muted mt-1">{t('master.equipInspect.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />{t('common.excel')}</Button>
          <Button size="sm" onClick={() => { setEditingItem(null); setIsModalOpen(true); }}><Plus className="w-4 h-4 mr-1" />{t('master.equipInspect.addItem')}</Button>
        </div>
      </div>
      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder={t('master.equipInspect.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <div className="w-40"><Select options={typeOptions} value={typeFilter} onChange={setTypeFilter} placeholder={t('master.equipInspect.inspectType')} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? t('master.equipInspect.editItem') : t('master.equipInspect.addItem')} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Input label={t('master.equipInspect.equipCode')} placeholder="CUT-001" defaultValue={editingItem?.equipCode} fullWidth />
          <Select label={t('master.equipInspect.inspectType')} options={typeOptions.filter(o => o.value)} value={editingItem?.inspectType || 'DAILY'} onChange={() => {}} fullWidth />
          <Input label={t('master.equipInspect.seq')} type="number" placeholder="1" defaultValue={editingItem?.seq?.toString()} fullWidth />
          <Select label={t('master.equipInspect.cycle')} options={cycleOptions} value={editingItem?.cycle || 'DAILY'} onChange={() => {}} fullWidth />
          <div className="col-span-2"><Input label={t('master.equipInspect.itemName')} placeholder="블레이드 마모 확인" defaultValue={editingItem?.itemName} fullWidth /></div>
          <div className="col-span-2"><Input label={t('master.equipInspect.criteria')} placeholder="마모선 이하" defaultValue={editingItem?.criteria} fullWidth /></div>
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
          <Button>{editingItem ? t('common.edit') : t('common.add')}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default EquipInspectPage;
