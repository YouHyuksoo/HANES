"use client";

/**
 * @file src/pages/master/EquipMasterPage.tsx
 * @description 설비마스터 페이지 - 설비 CRUD, 통신방식(MQTT/Serial) 설정
 *
 * 초보자 가이드:
 * 1. **설비 목록**: DataGrid로 설비 마스터 데이터 표시
 * 2. **설비 등록/수정**: 모달로 CRUD 처리
 * 3. **통신 설정**: MQTT, Serial, TCP 통신방식 설정
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import {
  Plus, Edit2, Trash2, Search, RefreshCw, Download, Settings,
  Wifi, Monitor,
} from 'lucide-react';
import { Card, CardContent, Button, Input, Select, Modal, ComCodeBadge } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';

// ========================================
// 타입 정의
// ========================================
type EquipType = 'CUTTING' | 'CRIMPING' | 'ASSEMBLY' | 'INSPECTION' | 'PACKING';
type CommType = 'MQTT' | 'SERIAL' | 'TCP' | 'NONE';

interface EquipMaster {
  id: string;
  equipCode: string;
  equipName: string;
  equipType: EquipType;
  lineName: string;
  commType: CommType;
  ipAddress?: string;
  port?: string;
  baudRate?: number;
  mqttTopic?: string;
  manufacturer?: string;
  model?: string;
  useYn: string;
  remark?: string;
}

// ========================================
// Mock 데이터
// ========================================
const mockEquipments: EquipMaster[] = [
  { id: '1', equipCode: 'CUT-001', equipName: '절단기 1호', equipType: 'CUTTING', lineName: 'L1', commType: 'TCP', ipAddress: '192.168.1.101', port: '5000', manufacturer: '두산', model: 'DC-100', useYn: 'Y' },
  { id: '2', equipCode: 'CUT-002', equipName: '절단기 2호', equipType: 'CUTTING', lineName: 'L1', commType: 'TCP', ipAddress: '192.168.1.102', port: '5000', manufacturer: '두산', model: 'DC-100', useYn: 'Y' },
  { id: '3', equipCode: 'CRM-001', equipName: '압착기 1호', equipType: 'CRIMPING', lineName: 'L2', commType: 'SERIAL', port: 'COM3', baudRate: 9600, manufacturer: 'TE', model: 'AP-200', useYn: 'Y' },
  { id: '4', equipCode: 'INSP-01', equipName: '통전검사기 1호', equipType: 'INSPECTION', lineName: 'L4', commType: 'MQTT', ipAddress: '192.168.1.201', port: '1883', mqttTopic: 'mes/insp/01', manufacturer: '대명', model: 'DM-CT100', useYn: 'Y' },
  { id: '5', equipCode: 'INSP-02', equipName: '통전검사기 2호', equipType: 'INSPECTION', lineName: 'L4', commType: 'MQTT', ipAddress: '192.168.1.202', port: '1883', mqttTopic: 'mes/insp/02', manufacturer: '대명', model: 'DM-CT100', useYn: 'Y' },
  { id: '6', equipCode: 'ASM-001', equipName: '조립기 1호', equipType: 'ASSEMBLY', lineName: 'L3', commType: 'NONE', manufacturer: '삼성', model: 'SA-300', useYn: 'Y', remark: '수동 설비' },
];

const commTypeOptions: { value: string; label: string }[] = [
  { value: 'NONE', label: 'None' },
  { value: 'TCP', label: 'TCP/IP' },
  { value: 'SERIAL', label: 'Serial' },
  { value: 'MQTT', label: 'MQTT' },
];

const lineOptions: { value: string; label: string }[] = [
  { value: '', label: '' },
  { value: 'L1', label: 'L1' },
  { value: 'L2', label: 'L2' },
  { value: 'L3', label: 'L3' },
  { value: 'L4', label: 'L4' },
];

const commTypeLabels: Record<CommType, { label: string; color: string }> = {
  MQTT: { label: 'MQTT', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  SERIAL: { label: 'Serial', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  TCP: { label: 'TCP/IP', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  NONE: { label: 'None', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
};

// ========================================
// 메인 컴포넌트
// ========================================
function EquipMasterPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [lineFilter, setLineFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEquip, setEditingEquip] = useState<EquipMaster | null>(null);
  const [formCommType, setFormCommType] = useState<CommType>('NONE');

  const equipTypeOptions = useMemo(() => [
    { value: '', label: t('master.equip.allTypes') },
    { value: 'CUTTING', label: t('master.equip.cutting') },
    { value: 'CRIMPING', label: t('master.equip.crimping') },
    { value: 'ASSEMBLY', label: t('master.equip.assembly') },
    { value: 'INSPECTION', label: t('master.equip.inspection') },
    { value: 'PACKING', label: t('master.equip.packing') },
  ], [t]);

  /* equipType 라벨은 ComCodeBadge에서 i18n 자동 처리 */

  const lineFilterOptions = useMemo(() => [
    { value: '', label: t('master.equip.allLines') },
    ...lineOptions.filter(o => o.value),
  ], [t]);

  const filteredData = useMemo(() => {
    return mockEquipments.filter((equip) => {
      if (typeFilter && equip.equipType !== typeFilter) return false;
      if (lineFilter && equip.lineName !== lineFilter) return false;
      if (searchText && !equip.equipCode.toLowerCase().includes(searchText.toLowerCase()) && !equip.equipName.toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    });
  }, [searchText, typeFilter, lineFilter]);

  const openModal = (equip: EquipMaster | null) => {
    setEditingEquip(equip);
    setFormCommType(equip?.commType || 'NONE');
    setIsModalOpen(true);
  };

  const columns = useMemo<ColumnDef<EquipMaster>[]>(() => [
    { accessorKey: 'equipCode', header: t('master.equip.equipCode'), size: 100 },
    { accessorKey: 'equipName', header: t('master.equip.equipName'), size: 140 },
    { accessorKey: 'equipType', header: t('master.equip.type'), size: 80, cell: ({ getValue }) => <ComCodeBadge groupCode="EQUIP_TYPE" code={getValue() as string} /> },
    { accessorKey: 'lineName', header: t('master.equip.line'), size: 50 },
    { accessorKey: 'commType', header: t('master.equip.commType'), size: 80, cell: ({ getValue }) => { const { label, color } = commTypeLabels[getValue() as CommType]; return <span className={`px-2 py-1 text-xs rounded-full ${color}`}>{label}</span>; }},
    { accessorKey: 'ipAddress', header: t('master.equip.ipPort'), size: 140, cell: ({ row }) => { const e = row.original; return e.commType === 'SERIAL' ? <span className="font-mono">{e.port}</span> : e.ipAddress ? <span className="font-mono">{e.ipAddress}:{e.port}</span> : '-'; }},
    { accessorKey: 'manufacturer', header: t('master.equip.manufacturer'), size: 80 },
    { accessorKey: 'model', header: t('master.equip.model'), size: 90 },
    { accessorKey: 'useYn', header: t('master.equip.use'), size: 50, cell: ({ getValue }) => <span className={`w-2 h-2 rounded-full inline-block ${getValue() === 'Y' ? 'bg-green-500' : 'bg-gray-400'}`} /> },
    { id: 'actions', header: t('common.actions'), size: 80, cell: ({ row }) => (
      <div className="flex gap-1">
        <button onClick={() => openModal(row.original)} className="p-1 hover:bg-surface rounded"><Edit2 className="w-4 h-4 text-primary" /></button>
        <button className="p-1 hover:bg-surface rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
      </div>
    )},
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Monitor className="w-7 h-7 text-primary" />{t('master.equip.title')}</h1>
          <p className="text-text-muted mt-1">{t('master.equip.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />{t('common.excel')}</Button>
          <Button size="sm" onClick={() => openModal(null)}><Plus className="w-4 h-4 mr-1" />{t('master.equip.addEquip')}</Button>
        </div>
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]"><Input placeholder={t('master.equip.searchPlaceholder')} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
            <Select options={equipTypeOptions} value={typeFilter} onChange={setTypeFilter} placeholder={t('master.equip.type')} />
            <Select options={lineFilterOptions} value={lineFilter} onChange={setLineFilter} placeholder={t('master.equip.line')} />
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid data={filteredData} columns={columns} pageSize={10} />
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEquip ? t('master.equip.editEquip') : t('master.equip.addEquip')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('master.equip.equipCode')} placeholder="CUT-001" defaultValue={editingEquip?.equipCode} fullWidth />
            <Input label={t('master.equip.equipName')} placeholder={t('master.equip.equipName')} defaultValue={editingEquip?.equipName} fullWidth />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label={t('master.equip.type')} options={equipTypeOptions.filter(o => o.value)} value={editingEquip?.equipType || 'CUTTING'} fullWidth />
            <Select label={t('master.equip.line')} options={lineOptions.filter(o => o.value)} value={editingEquip?.lineName || 'L1'} fullWidth />
            <Select label={t('master.equip.commType')} options={commTypeOptions} value={formCommType} onChange={(v) => setFormCommType(v as CommType)} fullWidth />
          </div>
          {(formCommType === 'TCP' || formCommType === 'MQTT') && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-background rounded-lg">
              <Input label={t('master.equip.ipAddress')} placeholder="192.168.1.100" defaultValue={editingEquip?.ipAddress} fullWidth leftIcon={<Wifi className="w-4 h-4" />} />
              <Input label={t('master.equip.port')} placeholder={formCommType === 'MQTT' ? '1883' : '5000'} defaultValue={editingEquip?.port} fullWidth />
              {formCommType === 'MQTT' && <div className="col-span-2"><Input label="MQTT Topic" placeholder="mes/equip/001" defaultValue={editingEquip?.mqttTopic} fullWidth /></div>}
            </div>
          )}
          {formCommType === 'SERIAL' && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-background rounded-lg">
              <Input label={t('master.equip.port')} placeholder="COM3" defaultValue={editingEquip?.port} fullWidth leftIcon={<Settings className="w-4 h-4" />} />
              <Input label="Baud Rate" placeholder="9600" defaultValue={editingEquip?.baudRate?.toString()} fullWidth />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('master.equip.manufacturer')} placeholder={t('master.equip.manufacturer')} defaultValue={editingEquip?.manufacturer} fullWidth />
            <Input label={t('master.equip.model')} placeholder={t('master.equip.model')} defaultValue={editingEquip?.model} fullWidth />
          </div>
          <Input label={t('master.equip.remark')} placeholder={t('master.equip.remarkPlaceholder')} defaultValue={editingEquip?.remark} fullWidth />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => setIsModalOpen(false)}>{editingEquip ? t('common.edit') : t('common.add')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default EquipMasterPage;
