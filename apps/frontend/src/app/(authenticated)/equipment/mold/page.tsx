"use client";

/**
 * @file src/app/(authenticated)/equipment/mold/page.tsx
 * @description 금형관리 페이지 - 실제 API 연동
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, Search, RefreshCw, Settings2, Package, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { useApiQuery } from '@/hooks/useApi';
import { useFilteredList } from '@/hooks/useFilteredList';
import { Mold, MoldStatus } from '@/types/mold';

function MoldPage() {
  const { t } = useTranslation();

  // 실제 API 호출
  const { data: response, isLoading, refetch } = useApiQuery<Mold[]>(
    ['mold', 'list'],
    '/molds'
  );
  const molds = response?.data || [];

  const statusOptions = [
    { value: '', label: t('crimping.mold.allStatus') },
    { value: 'NORMAL', label: t('crimping.mold.ok') },
    { value: 'WARNING', label: t('crimping.mold.warning') },
    { value: 'REPLACE', label: t('crimping.mold.replace') },
    { value: 'MAINT', label: t('crimping.mold.maint') },
  ];

  // 필터링
  const { filteredData, filters, stats, resetFilters } = useFilteredList(molds, {
    searchFields: ['moldCode', 'moldName', 'terminalName'],
    statusField: 'status',
    statusValues: ['NORMAL', 'WARNING', 'REPLACE', 'MAINT'],
  });

  const [selectedMold, setSelectedMold] = useState<Mold | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const columns: ColumnDef<Mold>[] = [
    { accessorKey: 'moldCode', header: t('crimping.mold.code'), size: 100 },
    { accessorKey: 'moldName', header: t('crimping.mold.name'), size: 150 },
    { accessorKey: 'terminalName', header: t('crimping.terminal'), size: 120 },
    {
      accessorKey: 'currentShots',
      header: t('crimping.mold.currentShots'),
      size: 100,
      cell: ({ getValue }) => Number(getValue()).toLocaleString(),
    },
    {
      accessorKey: 'expectedLife',
      header: t('crimping.mold.expectedLife'),
      size: 100,
      cell: ({ getValue }) => Number(getValue()).toLocaleString(),
    },
    {
      accessorKey: 'status',
      header: t('common.status'),
      size: 80,
      cell: ({ getValue }) => {
        const status = getValue() as MoldStatus;
        const config = {
          NORMAL: { icon: CheckCircle, color: 'text-green-500' },
          WARNING: { icon: AlertTriangle, color: 'text-yellow-500' },
          REPLACE: { icon: XCircle, color: 'text-red-500' },
          MAINT: { icon: Settings2, color: 'text-blue-500' },
        }[status] || { icon: Package, color: 'text-gray-500' };
        const Icon = config.icon;
        return <Icon className={`w-5 h-5 ${config.color}`} />;
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">{t('crimping.mold.title')}</h1>
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
      <div className="grid grid-cols-5 gap-4">
        <StatCard label={t('crimping.mold.total')} value={stats.total} icon={Package} color="blue" />
        <StatCard label={t('crimping.mold.ok')} value={stats.NORMAL || 0} icon={CheckCircle} color="green" />
        <StatCard label={t('crimping.mold.warning')} value={stats.WARNING || 0} icon={AlertTriangle} color="yellow" />
        <StatCard label={t('crimping.mold.replace')} value={stats.REPLACE || 0} icon={XCircle} color="red" />
        <StatCard label={t('crimping.mold.maint')} value={stats.MAINT || 0} icon={Settings2} color="purple" />
      </div>

      <Card>
        <CardContent className="p-4">
          <DataGrid
            columns={columns}
            data={filteredData}
            isLoading={isLoading}
            enableExport
            exportFileName={t('crimping.mold.title')}
            onRowClick={(row) => {
              setSelectedMold(row);
              setIsModalOpen(true);
            }}
            toolbarLeft={
              <div className="flex gap-2 items-center">
                <Input placeholder={t('common.search')} value={filters.searchTerm}
                  onChange={(e) => filters.setSearchTerm(e.target.value)} leftIcon={<Search className="w-4 h-4" />} />
                <Select value={filters.statusFilter} onChange={filters.setStatusFilter} options={statusOptions} />
                <Button variant="outline" onClick={resetFilters}>{t('common.reset')}</Button>
              </div>
            }
          />
        </CardContent>
      </Card>

      {/* 등록/수정 모달 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedMold(null);
        }}
        title={selectedMold ? t('crimping.mold.edit') : t('crimping.mold.add')}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('crimping.mold.code')} defaultValue={selectedMold?.moldCode} />
            <Input label={t('crimping.mold.name')} defaultValue={selectedMold?.moldName} />
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

export default MoldPage;
