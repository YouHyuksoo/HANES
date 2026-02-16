"use client";

/**
 * @file src/app/(authenticated)/equipment/pm/page.tsx
 * @description 예방보전 페이지 - 실제 API 연동
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, RefreshCw, Search, Wrench, CheckCircle, AlertTriangle, XCircle, Package } from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Input, Modal, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { useApiQuery } from '@/hooks/useApi';
import { useFilteredList } from '@/hooks/useFilteredList';
import { ConsumablePart, PartStatus, PartCategory } from '@/types/equipment';
import LifeProgressBar from '@/components/equipment/LifeProgressBar';
import { createPartColumns } from '@/lib/table-utils';

function PmPage() {
  const { t } = useTranslation();

  // 실제 API 호출
  const { data: response, isLoading, refetch } = useApiQuery<ConsumablePart[]>(
    ['consumable', 'list'],
    '/consumables'
  );
  const parts = response?.data || [];

  const categoryOptions = [
    { value: '', label: t('equipment.pm.allCategories') },
    { value: 'MOLD', label: t('equipment.pm.mold') },
    { value: 'JIG', label: t('equipment.pm.jig') },
    { value: 'TOOL', label: t('equipment.pm.tool') },
  ];

  const statusOptions = [
    { value: '', label: t('equipment.pm.allStatus') },
    { value: 'OK', label: t('equipment.pm.ok') },
    { value: 'WARNING', label: t('equipment.pm.warning') },
    { value: 'REPLACE', label: t('equipment.pm.replace') },
  ];

  // 필터링
  const { filteredData, filters, stats, resetFilters } = useFilteredList(parts, {
    searchFields: ['partCode', 'partName'],
  });

  const [selectedPart, setSelectedPart] = useState<ConsumablePart | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const columns: ColumnDef<ConsumablePart>[] = [
    ...createPartColumns<ConsumablePart>(t),
    {
      accessorKey: 'category',
      header: t('equipment.pm.category'),
      size: 80,
      cell: ({ getValue }) => {
        const cat = getValue() as PartCategory;
        const labels: Record<string, string> = {
          MOLD: t('equipment.pm.mold'),
          JIG: t('equipment.pm.jig'),
          TOOL: t('equipment.pm.tool'),
        };
        return labels[cat] || cat;
      },
    },
    {
      accessorKey: 'lifeProgress',
      header: t('equipment.pm.lifeProgress'),
      size: 150,
      cell: ({ row }) => (
        <LifeProgressBar
          current={row.original.currentShots}
          expected={row.original.expectedLife}
        />
      ),
    },
    {
      accessorKey: 'status',
      header: t('common.status'),
      size: 80,
      cell: ({ getValue }) => {
        const status = getValue() as PartStatus;
        const config = {
          OK: { icon: CheckCircle, color: 'text-green-500' },
          WARNING: { icon: AlertTriangle, color: 'text-yellow-500' },
          REPLACE: { icon: XCircle, color: 'text-red-500' },
        }[status] || { icon: Package, color: 'text-gray-500' };
        const Icon = config.icon;
        return <Icon className={`w-5 h-5 ${config.color}`} />;
      },
    },
    { accessorKey: 'equipCode', header: t('equipment.pm.equipmentCode'), size: 100 },
  ];

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">{t('equipment.pm.title')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t('common.add')}
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label={t('equipment.pm.total')} value={stats.total} icon={Package} color="blue" />
        <StatCard label={t('equipment.pm.ok')} value={stats.OK || 0} icon={CheckCircle} color="green" />
        <StatCard label={t('equipment.pm.warning')} value={stats.WARNING || 0} icon={AlertTriangle} color="yellow" />
        <StatCard label={t('equipment.pm.replace')} value={stats.REPLACE || 0} icon={XCircle} color="red" />
      </div>

      {/* 필터 */}
      <Card>
        <CardHeader className="p-4">
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
        </CardHeader>
        <CardContent className="p-0">
          <DataGrid
            columns={columns}
            data={filteredData}
            isLoading={isLoading}
            onRowClick={(row) => {
              setSelectedPart(row);
              setIsModalOpen(true);
            }}
          />
        </CardContent>
      </Card>

      {/* 등록/수정 모달 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPart(null);
        }}
        title={selectedPart ? t('equipment.pm.edit') : t('equipment.pm.add')}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t('equipment.pm.category')}
              options={categoryOptions.filter((o) => o.value)}
              value={selectedPart?.category || ''}
              fullWidth
            />
            <Input
              label={t('equipment.pm.equipmentCode')}
              placeholder="CRM-001"
              defaultValue={selectedPart?.equipCode}
              fullWidth
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button>{t('common.save')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default PmPage;
