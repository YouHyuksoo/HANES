"use client";

/**
 * @file src/pages/master/PartPage.tsx
 * @description 품목 마스터 관리 페이지
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, Search, RefreshCw, Download, Package } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface Part {
  id: string;
  partCode: string;
  partName: string;
  partType: string;
  spec?: string;
  unit: string;
  customer?: string;
  vendor?: string;
  safetyStock: number;
  useYn: string;
}

// Mock 데이터
const mockParts: Part[] = [
  { id: '1', partCode: 'W-001', partName: '전선 AWG18 RED', partType: 'RAW', spec: 'AWG18 1.0sq', unit: 'M', vendor: '대한전선', safetyStock: 1000, useYn: 'Y' },
  { id: '2', partCode: 'W-002', partName: '전선 AWG18 BLK', partType: 'RAW', spec: 'AWG18 1.0sq', unit: 'M', vendor: '대한전선', safetyStock: 1000, useYn: 'Y' },
  { id: '3', partCode: 'T-001', partName: '단자 110형', partType: 'RAW', spec: '110 Female', unit: 'EA', vendor: '현대커넥터', safetyStock: 5000, useYn: 'Y' },
  { id: '4', partCode: 'H-001', partName: '메인 하네스 A', partType: 'FG', spec: 'MAIN-A TYPE', unit: 'EA', customer: '현대자동차', safetyStock: 100, useYn: 'Y' },
  { id: '5', partCode: 'H-002', partName: '서브 하네스 B', partType: 'WIP', spec: 'SUB-B TYPE', unit: 'EA', customer: '현대자동차', safetyStock: 200, useYn: 'Y' },
];

function PartPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [partTypeFilter, setPartTypeFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);

  const partTypeOptions = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'RAW', label: t('inventory.stock.raw') },
    { value: 'WIP', label: t('inventory.stock.wip') },
    { value: 'FG', label: t('inventory.stock.fg') },
  ], [t]);

  const filteredParts = useMemo(() => {
    return mockParts.filter((part) => {
      const matchSearch = !searchText || part.partCode.toLowerCase().includes(searchText.toLowerCase()) || part.partName.toLowerCase().includes(searchText.toLowerCase());
      const matchType = !partTypeFilter || part.partType === partTypeFilter;
      return matchSearch && matchType;
    });
  }, [searchText, partTypeFilter]);

  const columns = useMemo<ColumnDef<Part>[]>(
    () => [
      { accessorKey: 'partCode', header: t('master.part.partCode'), size: 120 },
      { accessorKey: 'partName', header: t('master.part.partName'), size: 180 },
      {
        accessorKey: 'partType',
        header: t('master.part.type'),
        size: 80,
        cell: ({ getValue }) => {
          const typeMap: Record<string, { label: string; color: string }> = {
            RAW: { label: t('inventory.stock.raw'), color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
            WIP: { label: t('inventory.stock.wip'), color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
            FG: { label: t('inventory.stock.fg'), color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
          };
          const type = typeMap[getValue() as string] || { label: getValue(), color: 'bg-gray-100 text-gray-700' };
          return <span className={`px-2 py-1 text-xs rounded-full ${type.color}`}>{type.label}</span>;
        },
      },
      { accessorKey: 'spec', header: t('master.part.spec'), size: 150 },
      { accessorKey: 'unit', header: t('master.part.unit'), size: 60 },
      { accessorKey: 'vendor', header: t('master.part.vendor'), size: 120 },
      { accessorKey: 'customer', header: t('master.part.customer'), size: 120 },
      { accessorKey: 'safetyStock', header: t('master.part.safetyStock'), size: 80, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
      {
        accessorKey: 'useYn',
        header: t('master.part.use'),
        size: 60,
        cell: ({ getValue }) => (
          <span className={`w-2 h-2 rounded-full inline-block ${getValue() === 'Y' ? 'bg-green-500' : 'bg-gray-400'}`} />
        ),
      },
      {
        id: 'actions',
        header: t('common.actions'),
        size: 80,
        cell: ({ row }) => (
          <div className="flex gap-1">
            <button onClick={() => { setEditingPart(row.original); setIsModalOpen(true); }} className="p-1 hover:bg-surface rounded">
              <Edit2 className="w-4 h-4 text-primary" />
            </button>
            <button className="p-1 hover:bg-surface rounded">
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        ),
      },
    ],
    [t]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Package className="w-7 h-7 text-primary" />{t('master.part.title')}</h1>
          <p className="text-text-muted mt-1">{t('master.part.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <Download className="w-4 h-4 mr-1" /> {t('common.excel')}
          </Button>
          <Button size="sm" onClick={() => { setEditingPart(null); setIsModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> {t('master.part.addPart')}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent>
          {/* 검색 필터 */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder={t('master.part.searchPlaceholder')}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth
              />
            </div>
            <div className="w-40">
              <Select
                options={partTypeOptions}
                value={partTypeFilter}
                onChange={setPartTypeFilter}
                placeholder={t('master.part.type')}
                fullWidth
              />
            </div>
            <Button variant="secondary">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          <DataGrid data={filteredParts} columns={columns} pageSize={10} onRowClick={(row) => console.log('Selected:', row)} />
        </CardContent>
      </Card>

      {/* 품목 추가/수정 모달 */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingPart ? t('master.part.editPart') : t('master.part.addPart')} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Input label={t('master.part.partCode')} placeholder="W-001" defaultValue={editingPart?.partCode} fullWidth />
          <Select
            label={t('master.part.type')}
            options={partTypeOptions.filter(o => o.value)}
            value={editingPart?.partType || 'RAW'}
            onChange={() => {}}
            fullWidth
          />
          <div className="col-span-2">
            <Input label={t('master.part.partName')} placeholder="전선 AWG18 RED" defaultValue={editingPart?.partName} fullWidth />
          </div>
          <Input label={t('master.part.spec')} placeholder="AWG18 1.0sq" defaultValue={editingPart?.spec} fullWidth />
          <Input label={t('master.part.unit')} placeholder="M, EA, KG" defaultValue={editingPart?.unit || 'EA'} fullWidth />
          <Input label={t('master.part.vendor')} placeholder={t('master.part.vendor')} defaultValue={editingPart?.vendor} fullWidth />
          <Input label={t('master.part.customer')} placeholder={t('master.part.customer')} defaultValue={editingPart?.customer} fullWidth />
          <Input label={t('master.part.safetyStock')} type="number" placeholder="100" defaultValue={editingPart?.safetyStock?.toString()} fullWidth />
          <Input label={t('master.part.leadTime')} type="number" placeholder="7" fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
          <Button>{editingPart ? t('common.edit') : t('common.add')}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default PartPage;
