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
import { ColumnDef } from '@tanstack/react-table';
import { Plus, RefreshCw, Search, Settings, CheckCircle, AlertTriangle, XCircle, Edit, Monitor } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { useComCodeOptions } from '@/hooks/useComCode';
import { Equipment, EquipStatus, EquipType, equipTypeLabels } from './types';
import { EquipmentStatusBadge, statusConfig } from './components/EquipmentStatusBadge';

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

const equipTypeOptions = [
  { value: '', label: '전체 유형' }, { value: 'CUTTING', label: '절단' },
  { value: 'CRIMPING', label: '압착' }, { value: 'ASSEMBLY', label: '조립' }, { value: 'INSPECTION', label: '검사' },
];
const lineOptions = [
  { value: '', label: '전체 라인' }, { value: 'L1', label: 'L1' }, { value: 'L2', label: 'L2' }, { value: 'L3', label: 'L3' }, { value: 'L4', label: 'L4' },
];
function EquipStatusPage() {
  const comCodeOptions = useComCodeOptions('EQUIP_STATUS');
  const statusOptions = [{ value: '', label: '전체 상태' }, ...comCodeOptions];
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
    { accessorKey: 'equipCode', header: '설비코드', size: 100 },
    { accessorKey: 'equipName', header: '설비명', size: 120 },
    { accessorKey: 'equipType', header: '유형', size: 80, cell: ({ getValue }) => equipTypeLabels[getValue() as EquipType] },
    { accessorKey: 'lineName', header: '라인', size: 60 },
    { accessorKey: 'status', header: '상태', size: 80, cell: ({ getValue }) => <EquipmentStatusBadge status={getValue() as EquipStatus} /> },
    { accessorKey: 'ipAddress', header: 'IP주소', size: 130 },
    {
      id: 'actions', header: '관리', size: 100,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); setSelectedEquip(row.original); setIsModalOpen(true); }} className="p-1 hover:bg-surface rounded" title="수정"><Edit className="w-4 h-4 text-text-muted" /></button>
          <button onClick={(e) => { e.stopPropagation(); setSelectedEquip(row.original); setIsStatusModalOpen(true); }} className="p-1 hover:bg-surface rounded" title="상태변경"><Settings className="w-4 h-4 text-text-muted" /></button>
        </div>
      ),
    },
  ], []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Monitor className="w-7 h-7 text-primary" />설비 가동현황</h1>
          <p className="text-text-muted mt-1">설비의 상태를 모니터링하고 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"><RefreshCw className="w-4 h-4 mr-1" />새로고침</Button>
          <Button size="sm" onClick={() => { setSelectedEquip(null); setIsModalOpen(true); }}><Plus className="w-4 h-4 mr-1" />설비 등록</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="전체 설비" value={stats.total} icon={Monitor} color="blue" />
        <StatCard label="정상 가동" value={stats.normal} icon={CheckCircle} color="green" />
        <StatCard label="점검중" value={stats.maint} icon={AlertTriangle} color="yellow" />
        <StatCard label="정지" value={stats.stop} icon={XCircle} color="red" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]"><Input placeholder="설비코드, 설비명 검색..." value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
            <Select options={equipTypeOptions} value={typeFilter} onChange={setTypeFilter} placeholder="유형" />
            <Select options={lineOptions} value={lineFilter} onChange={setLineFilter} placeholder="라인" />
            <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} placeholder="상태" />
          </div>
          <DataGrid data={filteredEquipments} columns={columns} pageSize={10} onRowClick={(row) => { setSelectedEquip(row); setIsStatusModalOpen(true); }} />
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedEquip ? '설비 수정' : '설비 등록'} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="설비코드" placeholder="CUT-001" defaultValue={selectedEquip?.equipCode} fullWidth />
            <Input label="설비명" placeholder="절단기 1호" defaultValue={selectedEquip?.equipName} fullWidth />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="유형" options={equipTypeOptions.filter(o => o.value)} value={selectedEquip?.equipType || ''} fullWidth />
            <Select label="라인" options={lineOptions.filter(o => o.value)} value={selectedEquip?.lineName || ''} fullWidth />
          </div>
          <Input label="IP주소" placeholder="192.168.1.xxx" defaultValue={selectedEquip?.ipAddress} fullWidth />
          <Input label="비고" placeholder="비고 입력" defaultValue={selectedEquip?.remark} fullWidth />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>취소</Button>
            <Button onClick={() => setIsModalOpen(false)}>{selectedEquip ? '수정' : '등록'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isStatusModalOpen} onClose={() => { setIsStatusModalOpen(false); setSelectedEquip(null); }} title="상태 변경" size="sm">
        {selectedEquip && (
          <div className="space-y-4">
            <div className="p-4 bg-background rounded-lg">
              <div className="text-sm text-text-muted">선택된 설비</div>
              <div className="text-lg font-semibold text-text mt-1">{selectedEquip.equipName}</div>
              <div className="text-sm text-text-muted mt-1">{selectedEquip.equipCode}</div>
              <div className="mt-2"><span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${statusConfig[selectedEquip.status].color}`}>{statusConfig[selectedEquip.status].label}</span></div>
            </div>
            <div className="text-sm font-medium text-text mb-2">변경할 상태 선택</div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="secondary" onClick={() => handleStatusChange('NORMAL')} disabled={selectedEquip.status === 'NORMAL'}><CheckCircle className="w-4 h-4 mr-1 text-green-500" />정상</Button>
              <Button variant="secondary" onClick={() => handleStatusChange('MAINT')} disabled={selectedEquip.status === 'MAINT'}><AlertTriangle className="w-4 h-4 mr-1 text-yellow-500" />점검</Button>
              <Button variant="secondary" onClick={() => handleStatusChange('STOP')} disabled={selectedEquip.status === 'STOP'}><XCircle className="w-4 h-4 mr-1 text-red-500" />정지</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default EquipStatusPage;
