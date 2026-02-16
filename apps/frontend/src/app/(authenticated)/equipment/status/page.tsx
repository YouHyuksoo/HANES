"use client";

/**
 * @file src/app/(authenticated)/equipment/status/page.tsx
 * @description 설비 가동현황 페이지 - 실제 API 연동
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, RefreshCw, Search, Settings, Edit, Monitor } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { useComCodeOptions } from '@/hooks/useComCode';
import { Equipment, EquipmentStatus } from '@/types/equipment';
import { EquipmentStatusBadge } from '@/components/equipment/EquipmentStatusBadge';
import { useApiQuery } from '@/hooks/useApi';
import { useFilteredList } from '@/hooks/useFilteredList';

function EquipStatusPage() {
  const { t } = useTranslation();

  // 실제 API 호출
  const { data: response, isLoading, refetch } = useApiQuery<Equipment[]>(
    ['equipment', 'list'],
    '/equipment'
  );
  const equipments = response?.data || [];

  const equipTypeOptions = [
    { value: '', label: t('equipment.status.allTypes') },
    { value: 'SINGLE_CUT', label: t('equipment.status.cutting') },
    { value: 'AUTO_CRIMP', label: t('equipment.status.crimping') },
    { value: 'OTHER', label: t('equipment.status.assembly') },
    { value: 'INSPECTION', label: t('equipment.status.inspection') },
  ];

  const lineOptions = [
    { value: '', label: t('equipment.status.allLines') },
    { value: 'L1', label: 'L1' },
    { value: 'L2', label: 'L2' },
    { value: 'L3', label: 'L3' },
    { value: 'L4', label: 'L4' },
  ];

  const comCodeOptions = useComCodeOptions('EQUIP_STATUS');
  const statusOptions = [{ value: '', label: t('common.allStatus') }, ...comCodeOptions];

  // 필터링 훅 사용
  const { filteredData, filters, stats, resetFilters } = useFilteredList(equipments, {
    searchFields: ['equipCode', 'equipName'],
    statusField: 'status',
    statusValues: ['NORMAL', 'MAINT', 'STOP'],
  });

  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const columns: ColumnDef<Equipment>[] = [
    { accessorKey: 'equipCode', header: t('equipment.code'), size: 100 },
    { accessorKey: 'equipName', header: t('equipment.name'), size: 150 },
    { accessorKey: 'equipType', header: t('equipment.type'), size: 100 },
    { accessorKey: 'lineCode', header: t('equipment.line'), size: 80 },
    {
      accessorKey: 'status',
      header: t('common.status'),
      size: 80,
      cell: ({ getValue }) => <EquipmentStatusBadge status={getValue() as EquipmentStatus} />,
    },
    { accessorKey: 'ipAddress', header: 'IP', size: 120 },
  ];

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">{t('equipment.status.title')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            {t('common.add')}
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label={t('equipment.total')} value={stats.total} icon={Monitor} color="blue" />
        <StatCard label={t('equipment.normal')} value={stats.NORMAL || 0} icon={Settings} color="green" />
        <StatCard label={t('equipment.maint')} value={stats.MAINT || 0} icon={Edit} color="yellow" />
        <StatCard label={t('equipment.stop')} value={stats.STOP || 0} icon={Settings} color="red" />
      </div>

      {/* 필터 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder={t('common.search')}
                value={filters.searchTerm}
                onChange={(e) => filters.setSearchTerm(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
            <Select
              value={filters.statusFilter}
              onChange={filters.setStatusFilter}
              options={statusOptions}
            />
            <Button variant="outline" onClick={resetFilters}>
              {t('common.reset')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 데이터 그리드 */}
      <Card>
        <CardContent className="p-0">
          <DataGrid
            columns={columns}
            data={filteredData}
            isLoading={isLoading}
            onRowClick={(row) => {
              setSelectedEquipment(row);
              setIsEditModalOpen(true);
            }}
          />
        </CardContent>
      </Card>

      {/* 수정 모달 */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={t('equipment.edit')}
      >
        {selectedEquipment && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('equipment.code')} value={selectedEquipment.equipCode} disabled />
              <Input label={t('equipment.name')} value={selectedEquipment.equipName} disabled />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button>{t('common.save')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default EquipStatusPage;
