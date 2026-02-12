"use client";

/**
 * @file src/pages/equipment/EquipStatusPage.tsx
 * @description 설비 가동현황 페이지 - 설비 목록 및 상태 관리
 *
 * 초보자 가이드:
 * 1. **설비 상태**: NORMAL(정상), MAINT(점검중), STOP(정지)
 * 2. **필터링**: 유형, 라인, 상태별 조회 가능
 * 3. **상태 변경**: 설비 상태를 직접 변경 가능
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, RefreshCw, Search, Settings, CheckCircle, AlertTriangle, XCircle, Edit, Monitor } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { useComCodeOptions } from '@/hooks/useComCode';
import { Equipment, EquipStatus, EquipType, equipTypeLabels } from '@/types/equipment';
import { EquipmentStatusBadge, statusConfig } from '@/components/equipment/EquipmentStatusBadge';

// Mock 데이터
const mockEquipments: Equipment[] = [
  { id: '1', equipCode: 'CUT-001', equipName: '절단기 1호', equipType: 'CUTTING', lineName: 'L1', status: 'NORMAL', ipAddress: '192.168.1.101' },
  { id: '2', equipCode: 'CUT-002', equipName: '절단기 2호', equipType: 'CUTTING', lineName: 'L1', status: 'MAINT', ipAddress: '192.168.1.102', remark: '정기점검' },
  { id: '3', equipCode: 'CRM-001', equipName: '압착기 1호', equipType: 'CRIMPING', lineName: 'L2', status: 'NORMAL', ipAddress: '192.168.1.201' },
  { id: '4', equipCode: 'CRM-002', equipName: '압착기 2호', equipType: 'CRIMPING', lineName: 'L2', status: 'STOP', ipAddress: '192.168.1.202', remark: '고장 수리중' },
  { id: '5', equipCode: 'ASM-001', equipName: '조립기 1호', equipType: 'ASSEMBLY', lineName: 'L3', status: 'NORMAL', ipAddress: '192.168.1.301' },
  { id: '6', equipCode: 'INS-001', equipName: '검사기 1호', equipType: 'INSPECTION', lineName: 'L4', status: 'NORMAL', ipAddress: '192.168.1.401' },
  { id: '7', equipCode: 'INS-002', equipName: '검사기 2호', equipType: 'INSPECTION', lineName: 'L4', status: 'MAINT', ipAddress: '192.168.1.402' },
];

function EquipStatusPage() {
  const { t } = useTranslation();

  const equipTypeOptions = useMemo(() => [
    { value: '', label: t('equipment.status.allTypes') }, { value: 'CUTTING', label: t('equipment.status.cutting') },
    { value: 'CRIMPING', label: t('equipment.status.crimping') }, { value: 'ASSEMBLY', label: t('equipment.status.assembly') }, { value: 'INSPECTION', label: t('equipment.status.inspection') },
  ], [t]);
  const lineOptions = useMemo(() => [
    { value: '', label: t('equipment.status.allLines') }, { value: 'L1', label: 'L1' }, { value: 'L2', label: 'L2' }, { value: 'L3', label: 'L3' }, { value: 'L4', label: 'L4' },
  ], [t]);

  const comCodeOptions = useComCodeOptions('EQUIP_STATUS');
  const statusOptions = useMemo(() => [{ value: '', label: t('common.allStatus') }, ...comCodeOptions], [t, comCodeOptions]);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [lineFilter, setLineFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEquip, setSelectedEquip] = useState<Equipment | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  const filteredEquipments = useMemo(() => {
    return mockEquipments.filter((equip) => {
      const matchSearch = !searchText || equip.equipCode.toLowerCase().includes(searchText.toLowerCase()) || equip.equipName.toLowerCase().includes(searchText.toLowerCase());
      return matchSearch && (!typeFilter || equip.equipType === typeFilter) && (!lineFilter || equip.lineName === lineFilter) && (!statusFilter || equip.status === statusFilter);
    });
  }, [searchText, typeFilter, lineFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: mockEquipments.length, normal: mockEquipments.filter((e) => e.status === 'NORMAL').length,
    maint: mockEquipments.filter((e) => e.status === 'MAINT').length, stop: mockEquipments.filter((e) => e.status === 'STOP').length,
  }), []);

  const handleStatusChange = (newStatus: EquipStatus) => {
    if (selectedEquip) console.log(`설비 ${selectedEquip.equipCode} 상태 변경: ${newStatus}`);
    setIsStatusModalOpen(false);
    setSelectedEquip(null);
  };

  const columns = useMemo<ColumnDef<Equipment>[]>(() => [
    { accessorKey: 'equipCode', header: t('equipment.status.equipCode'), size: 100 },
    { accessorKey: 'equipName', header: t('equipment.status.equipName'), size: 120 },
    { accessorKey: 'equipType', header: t('equipment.status.type'), size: 80, cell: ({ getValue }) => equipTypeLabels[getValue() as EquipType] },
    { accessorKey: 'lineName', header: t('equipment.status.line'), size: 60 },
    { accessorKey: 'status', header: t('common.status'), size: 80, cell: ({ getValue }) => <EquipmentStatusBadge status={getValue() as EquipStatus} /> },
    { accessorKey: 'ipAddress', header: t('equipment.status.ipAddress'), size: 130 },
    {
      id: 'actions', header: t('common.manage'), size: 100,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); setSelectedEquip(row.original); setIsModalOpen(true); }} className="p-1 hover:bg-surface rounded" title={t('common.edit')}><Edit className="w-4 h-4 text-text-muted" /></button>
          <button onClick={(e) => { e.stopPropagation(); setSelectedEquip(row.original); setIsStatusModalOpen(true); }} className="p-1 hover:bg-surface rounded" title={t('equipment.status.changeStatus')}><Settings className="w-4 h-4 text-text-muted" /></button>
        </div>
      ),
    },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Monitor className="w-7 h-7 text-primary" />{t('equipment.status.title')}</h1>
          <p className="text-text-muted mt-1">{t('equipment.status.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"><RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}</Button>
          <Button size="sm" onClick={() => { setSelectedEquip(null); setIsModalOpen(true); }}><Plus className="w-4 h-4 mr-1" />{t('equipment.status.register')}</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t('equipment.status.totalEquipment')} value={stats.total} icon={Monitor} color="blue" />
        <StatCard label={t('equipment.status.normalOp')} value={stats.normal} icon={CheckCircle} color="green" />
        <StatCard label={t('equipment.status.maintenance')} value={stats.maint} icon={AlertTriangle} color="yellow" />
        <StatCard label={t('equipment.status.stopped')} value={stats.stop} icon={XCircle} color="red" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]"><Input placeholder={t('equipment.status.searchPlaceholder')} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
            <Select options={equipTypeOptions} value={typeFilter} onChange={setTypeFilter} placeholder={t('equipment.status.type')} />
            <Select options={lineOptions} value={lineFilter} onChange={setLineFilter} placeholder={t('equipment.status.line')} />
            <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} placeholder={t('common.status')} />
          </div>
          <DataGrid data={filteredEquipments} columns={columns} pageSize={10} onRowClick={(row) => { setSelectedEquip(row); setIsStatusModalOpen(true); }} />
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedEquip ? t('equipment.status.editEquip') : t('equipment.status.register')} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('equipment.status.equipCode')} placeholder="CUT-001" defaultValue={selectedEquip?.equipCode} fullWidth />
            <Input label={t('equipment.status.equipName')} placeholder={t('equipment.status.equipNamePlaceholder')} defaultValue={selectedEquip?.equipName} fullWidth />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('equipment.status.type')} options={equipTypeOptions.filter(o => o.value)} value={selectedEquip?.equipType || ''} fullWidth />
            <Select label={t('equipment.status.line')} options={lineOptions.filter(o => o.value)} value={selectedEquip?.lineName || ''} fullWidth />
          </div>
          <Input label={t('equipment.status.ipAddress')} placeholder="192.168.1.xxx" defaultValue={selectedEquip?.ipAddress} fullWidth />
          <Input label={t('common.remark')} placeholder={t('common.remarkPlaceholder')} defaultValue={selectedEquip?.remark} fullWidth />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => setIsModalOpen(false)}>{selectedEquip ? t('common.edit') : t('common.register')}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isStatusModalOpen} onClose={() => { setIsStatusModalOpen(false); setSelectedEquip(null); }} title={t('equipment.status.changeStatus')} size="sm">
        {selectedEquip && (
          <div className="space-y-4">
            <div className="p-4 bg-background rounded-lg">
              <div className="text-sm text-text-muted">{t('equipment.status.selectedEquip')}</div>
              <div className="text-lg font-semibold text-text mt-1">{selectedEquip.equipName}</div>
              <div className="text-sm text-text-muted mt-1">{selectedEquip.equipCode}</div>
              <div className="mt-2"><span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${statusConfig[selectedEquip.status].color}`}>{statusConfig[selectedEquip.status].label}</span></div>
            </div>
            <div className="text-sm font-medium text-text mb-2">{t('equipment.status.selectStatus')}</div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="secondary" onClick={() => handleStatusChange('NORMAL')} disabled={selectedEquip.status === 'NORMAL'}><CheckCircle className="w-4 h-4 mr-1 text-green-500" />{t('equipment.status.normal')}</Button>
              <Button variant="secondary" onClick={() => handleStatusChange('MAINT')} disabled={selectedEquip.status === 'MAINT'}><AlertTriangle className="w-4 h-4 mr-1 text-yellow-500" />{t('equipment.status.maint')}</Button>
              <Button variant="secondary" onClick={() => handleStatusChange('STOP')} disabled={selectedEquip.status === 'STOP'}><XCircle className="w-4 h-4 mr-1 text-red-500" />{t('equipment.status.stop')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default EquipStatusPage;
