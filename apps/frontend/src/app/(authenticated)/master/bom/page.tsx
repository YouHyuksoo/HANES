"use client";

/**
 * @file src/pages/master/BomPage.tsx
 * @description BOM 관리 페이지
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, Search, ChevronRight, Package, Layers } from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Input, Modal } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface BomItem {
  id: string;
  childPartCode: string;
  childPartName: string;
  childPartType: string;
  qtyPer: number;
  unit: string;
  revision: string;
  useYn: string;
}

interface ParentPart {
  id: string;
  partCode: string;
  partName: string;
  partType: string;
  bomCount: number;
}

// Mock 데이터
const mockParents: ParentPart[] = [
  { id: '1', partCode: 'H-001', partName: '메인 하네스 A', partType: 'FG', bomCount: 5 },
  { id: '2', partCode: 'H-002', partName: '서브 하네스 B', partType: 'WIP', bomCount: 3 },
  { id: '3', partCode: 'H-003', partName: '엔진룸 하네스', partType: 'FG', bomCount: 8 },
];

const mockBomItems: BomItem[] = [
  { id: '1', childPartCode: 'W-001', childPartName: '전선 AWG18 RED', childPartType: 'RAW', qtyPer: 2.5, unit: 'M', revision: 'A', useYn: 'Y' },
  { id: '2', childPartCode: 'W-002', childPartName: '전선 AWG18 BLK', childPartType: 'RAW', qtyPer: 1.8, unit: 'M', revision: 'A', useYn: 'Y' },
  { id: '3', childPartCode: 'T-001', childPartName: '단자 110형', childPartType: 'RAW', qtyPer: 4, unit: 'EA', revision: 'A', useYn: 'Y' },
  { id: '4', childPartCode: 'T-002', childPartName: '커넥터 12P', childPartType: 'RAW', qtyPer: 1, unit: 'EA', revision: 'A', useYn: 'Y' },
  { id: '5', childPartCode: 'C-001', childPartName: '튜브 10mm', childPartType: 'RAW', qtyPer: 0.5, unit: 'M', revision: 'A', useYn: 'Y' },
];

function BomPage() {
  const { t } = useTranslation();
  const [selectedParent, setSelectedParent] = useState<ParentPart | null>(mockParents[0]);
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBom, setEditingBom] = useState<BomItem | null>(null);

  const columns = useMemo<ColumnDef<BomItem>[]>(
    () => [
      { accessorKey: 'childPartCode', header: t('master.bom.childPartCode'), size: 120 },
      { accessorKey: 'childPartName', header: t('master.bom.childPartName'), size: 180 },
      {
        accessorKey: 'childPartType',
        header: t('master.bom.type'),
        size: 80,
        cell: ({ getValue }) => {
          const typeMap: Record<string, { label: string; color: string }> = {
            RAW: { label: t('inventory.stock.raw'), color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
            WIP: { label: t('inventory.stock.wip'), color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
          };
          const type = typeMap[getValue() as string] || { label: getValue(), color: 'bg-gray-100 text-gray-700' };
          return <span className={`px-2 py-1 text-xs rounded-full ${type.color}`}>{type.label}</span>;
        },
      },
      {
        accessorKey: 'qtyPer',
        header: t('master.bom.qtyPer'),
        size: 100,
        cell: ({ row }) => `${row.original.qtyPer} ${row.original.unit}`,
      },
      { accessorKey: 'revision', header: t('master.bom.revision'), size: 80 },
      {
        accessorKey: 'useYn',
        header: t('master.bom.use'),
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
            <button onClick={() => { setEditingBom(row.original); setIsModalOpen(true); }} className="p-1 hover:bg-surface rounded">
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
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Layers className="w-7 h-7 text-primary" />{t('master.bom.title')}</h1>
          <p className="text-text-muted mt-1">{t('master.bom.subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => { setEditingBom(null); setIsModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> {t('master.bom.addBom')}
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 부모 품목 목록 */}
        <div className="col-span-4">
          <Card>
            <CardHeader title={t('master.bom.parentPart')} subtitle={t('master.bom.selectParent')} />
            <CardContent>
              <Input
                placeholder={t('master.bom.searchPlaceholder')}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth
                className="mb-3"
              />
              <div className="space-y-1">
                {mockParents.map((parent) => (
                  <button
                    key={parent.id}
                    onClick={() => setSelectedParent(parent)}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm transition-colors ${selectedParent?.id === parent.id ? 'bg-primary text-white' : 'hover:bg-surface text-text'}`}
                  >
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      <div className="text-left">
                        <div className="font-medium">{parent.partCode}</div>
                        <div className={`text-xs ${selectedParent?.id === parent.id ? 'text-white/70' : 'text-text-muted'}`}>{parent.partName}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${selectedParent?.id === parent.id ? 'bg-white/20 text-white' : 'bg-surface text-text-muted'}`}>
                        {parent.bomCount}
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* BOM 상세 */}
        <div className="col-span-8">
          <Card>
            <CardHeader
              title={selectedParent ? `${t('master.bom.bomDetail')} - ${selectedParent.partCode}` : t('master.bom.bomDetail')}
              subtitle={selectedParent ? `${selectedParent.partName} (${mockBomItems.length}${t('master.bom.materialsCount')})` : t('master.bom.selectParent')}
            />
            <CardContent>
              {selectedParent ? (
                <DataGrid data={mockBomItems} columns={columns} pageSize={10} />
              ) : (
                <div className="flex items-center justify-center h-64 text-text-muted">
                  {t('master.bom.selectParentPrompt')}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* BOM 추가/수정 모달 */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingBom ? t('master.bom.editBom') : t('master.bom.addBom')} size="md">
        <div className="space-y-4">
          <Input label={t('master.bom.parentPart')} value={selectedParent?.partCode || ''} disabled fullWidth />
          <Input label={t('master.bom.childPartCode')} placeholder={t('master.bom.searchChildPlaceholder')} defaultValue={editingBom?.childPartCode} fullWidth />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('master.bom.qtyPer')} type="number" step="0.01" placeholder="1.0" defaultValue={editingBom?.qtyPer?.toString()} fullWidth />
            <Input label={t('master.bom.unitLabel')} placeholder="EA, M, KG" defaultValue={editingBom?.unit || 'EA'} fullWidth />
          </div>
          <Input label={t('master.bom.revision')} placeholder="A" defaultValue={editingBom?.revision || 'A'} fullWidth />
          <Input label={t('master.bom.remark')} placeholder={t('master.bom.remarkPlaceholder')} fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
          <Button>{editingBom ? t('common.edit') : t('common.add')}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default BomPage;
