"use client";

/**
 * @file src/pages/equipment/PmPage.tsx
 * @description 예방보전 페이지 - 소모품 수명 관리 및 교체 추적
 *
 * 초보자 가이드:
 * 1. **소모품 상태**: OK(정상), WARNING(경고), REPLACE(교체필요)
 * 2. **카테고리**: MOLD(금형), JIG(지그), TOOL(공구)
 * 3. **수명 관리**: 현재타수/기대수명으로 진행률 표시
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, RefreshCw, Search, Wrench, RotateCcw, Package, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Input, Modal, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ConsumablePart, PartStatus, PartCategory } from '@/types/equipment';
import { ComCodeBadge } from '@/components/ui';
import { PartStatusBadge, partStatusConfig } from '@/components/equipment/PartStatusBadge';
import LifeProgressBar from '@/components/equipment/LifeProgressBar';

// Mock 데이터
const mockParts: ConsumablePart[] = [
  { id: '1', partCode: 'MD-001', partName: '터미널 금형 A', category: 'MOLD', currentShots: 45000, expectedLife: 100000, status: 'OK', lastReplacedAt: '2024-12-15', equipmentCode: 'CRM-001' },
  { id: '2', partCode: 'MD-002', partName: '터미널 금형 B', category: 'MOLD', currentShots: 82000, expectedLife: 100000, status: 'WARNING', lastReplacedAt: '2024-10-20', equipmentCode: 'CRM-002' },
  { id: '3', partCode: 'MD-003', partName: '하우징 금형 C', category: 'MOLD', currentShots: 95000, expectedLife: 100000, status: 'REPLACE', lastReplacedAt: '2024-08-10', equipmentCode: 'CRM-001' },
  { id: '4', partCode: 'JG-001', partName: '조립 지그 1호', category: 'JIG', currentShots: 12000, expectedLife: 50000, status: 'OK', lastReplacedAt: '2025-01-05', equipmentCode: 'ASM-001' },
  { id: '5', partCode: 'JG-002', partName: '조립 지그 2호', category: 'JIG', currentShots: 38000, expectedLife: 50000, status: 'WARNING', lastReplacedAt: '2024-11-12', equipmentCode: 'ASM-002' },
  { id: '6', partCode: 'TL-001', partName: '절단 블레이드 A', category: 'TOOL', currentShots: 8000, expectedLife: 20000, status: 'OK', lastReplacedAt: '2025-01-10', equipmentCode: 'CUT-001' },
  { id: '7', partCode: 'TL-002', partName: '절단 블레이드 B', category: 'TOOL', currentShots: 19500, expectedLife: 20000, status: 'REPLACE', lastReplacedAt: '2024-09-25', equipmentCode: 'CUT-002' },
];

function PmPage() {
  const { t } = useTranslation();

  const categoryOptions = useMemo(() => [
    { value: '', label: t('equipment.pm.allCategories') },
    { value: 'MOLD', label: t('equipment.pm.mold') },
    { value: 'JIG', label: t('equipment.pm.jig') },
    { value: 'TOOL', label: t('equipment.pm.tool') },
  ], [t]);
  const statusOptions = useMemo(() => [
    { value: '', label: t('common.allStatus') },
    { value: 'OK', label: t('equipment.pm.ok') },
    { value: 'WARNING', label: t('equipment.pm.warning') },
    { value: 'REPLACE', label: t('equipment.pm.replace') },
  ], [t]);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<ConsumablePart | null>(null);

  const filteredParts = useMemo(() => {
    return mockParts.filter((part) => {
      const matchSearch = !searchText || part.partCode.toLowerCase().includes(searchText.toLowerCase()) || part.partName.toLowerCase().includes(searchText.toLowerCase());
      return matchSearch && (!categoryFilter || part.category === categoryFilter) && (!statusFilter || part.status === statusFilter);
    });
  }, [searchText, categoryFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: mockParts.length, ok: mockParts.filter((p) => p.status === 'OK').length,
    warning: mockParts.filter((p) => p.status === 'WARNING').length, replace: mockParts.filter((p) => p.status === 'REPLACE').length,
  }), []);

  const urgentParts = useMemo(() =>
    mockParts.filter((p) => p.status === 'WARNING' || p.status === 'REPLACE').sort((a, b) => (b.currentShots / b.expectedLife) - (a.currentShots / a.expectedLife)), []);

  const handleReplace = () => {
    if (selectedPart) console.log(`소모품 ${selectedPart.partCode} 교체 등록`);
    setIsReplaceModalOpen(false);
    setSelectedPart(null);
  };

  const columns = useMemo<ColumnDef<ConsumablePart>[]>(() => [
    { accessorKey: 'partCode', header: t('equipment.pm.code'), size: 90 },
    { accessorKey: 'partName', header: t('equipment.pm.name'), size: 140 },
    { accessorKey: 'category', header: t('equipment.pm.category'), size: 80, cell: ({ getValue }) => <ComCodeBadge groupCode="CONSUMABLE_CATEGORY" code={getValue() as string} /> },
    {
      id: 'life', header: t('equipment.pm.currentExpectedLife'), size: 150,
      cell: ({ row }) => (<div><div className="text-sm">{row.original.currentShots.toLocaleString()} / {row.original.expectedLife.toLocaleString()}</div><LifeProgressBar current={row.original.currentShots} expected={row.original.expectedLife} /></div>),
    },
    { accessorKey: 'status', header: t('common.status'), size: 90, cell: ({ getValue }) => <PartStatusBadge status={getValue() as PartStatus} /> },
    { accessorKey: 'lastReplacedAt', header: t('equipment.pm.lastReplaced'), size: 100 },
    { id: 'actions', header: t('common.manage'), size: 80, cell: ({ row }) => (<button onClick={(e) => { e.stopPropagation(); setSelectedPart(row.original); setIsReplaceModalOpen(true); }} className="p-1 hover:bg-surface rounded" title={t('equipment.pm.registerReplace')}><RotateCcw className="w-4 h-4 text-primary" /></button>) },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Wrench className="w-7 h-7 text-primary" />{t('equipment.pm.title')}</h1>
          <p className="text-text-muted mt-1">{t('equipment.pm.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"><RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}</Button>
          <Button size="sm" onClick={() => { setSelectedPart(null); setIsModalOpen(true); }}><Plus className="w-4 h-4 mr-1" />{t('equipment.pm.registerPart')}</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t('equipment.pm.totalParts')} value={stats.total} icon={Wrench} color="blue" />
        <StatCard label={t('equipment.pm.ok')} value={stats.ok} icon={CheckCircle} color="green" />
        <StatCard label={t('equipment.pm.warning')} value={stats.warning} icon={AlertTriangle} color="yellow" />
        <StatCard label={t('equipment.pm.replace')} value={stats.replace} icon={XCircle} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardContent>
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex-1 min-w-[200px]"><Input placeholder={t('equipment.pm.searchPlaceholder')} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
                <Select options={categoryOptions} value={categoryFilter} onChange={setCategoryFilter} placeholder={t('equipment.pm.category')} />
                <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} placeholder={t('common.status')} />
              </div>
              <DataGrid data={filteredParts} columns={columns} pageSize={10} onRowClick={(row) => { setSelectedPart(row); setIsReplaceModalOpen(true); }} />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card>
            <CardHeader title={t('equipment.pm.replacePlan')} subtitle={t('equipment.pm.replacePlanSubtitle')} />
            <CardContent>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {urgentParts.length === 0 ? (<div className="text-center py-8 text-text-muted">{t('equipment.pm.noReplacePlan')}</div>) : (
                  urgentParts.map((part) => (
                    <div key={part.id} className={`p-3 rounded-lg border border-border cursor-pointer hover:shadow-md transition-shadow ${partStatusConfig[part.status].bgColor}`} onClick={() => { setSelectedPart(part); setIsReplaceModalOpen(true); }}>
                      <div className="flex justify-between items-start">
                        <div><div className="font-medium text-text">{part.partName}</div><div className="text-sm text-text-muted">{part.partCode} | {t(`comCode.CONSUMABLE_CATEGORY.${part.category}`, { defaultValue: part.category })}</div></div>
                        <PartStatusBadge status={part.status} />
                      </div>
                      <div className="mt-2"><LifeProgressBar current={part.currentShots} expected={part.expectedLife} /></div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedPart ? t('equipment.pm.editPart') : t('equipment.pm.registerPart')} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('equipment.pm.code')} placeholder="MD-001" defaultValue={selectedPart?.partCode} fullWidth />
            <Input label={t('equipment.pm.name')} placeholder={t('equipment.pm.namePlaceholder')} defaultValue={selectedPart?.partName} fullWidth />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('equipment.pm.category')} options={categoryOptions.filter(o => o.value)} value={selectedPart?.category || ''} fullWidth />
            <Input label={t('equipment.pm.equipmentCode')} placeholder="CRM-001" defaultValue={selectedPart?.equipmentCode} fullWidth />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('equipment.pm.currentShots')} type="number" placeholder="0" defaultValue={String(selectedPart?.currentShots || 0)} fullWidth />
            <Input label={t('equipment.pm.expectedLife')} type="number" placeholder="100000" defaultValue={String(selectedPart?.expectedLife || 100000)} fullWidth />
          </div>
          <Input label={t('common.remark')} placeholder={t('common.remarkPlaceholder')} defaultValue={selectedPart?.remark} fullWidth />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => setIsModalOpen(false)}>{selectedPart ? t('common.edit') : t('common.register')}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isReplaceModalOpen} onClose={() => { setIsReplaceModalOpen(false); setSelectedPart(null); }} title={t('equipment.pm.registerReplace')} size="sm">
        {selectedPart && (
          <div className="space-y-4">
            <div className="p-4 bg-background rounded-lg">
              <div className="flex items-center gap-2 text-text-muted text-sm"><Package className="w-4 h-4" />{t('equipment.pm.selectedPart')}</div>
              <div className="text-lg font-semibold text-text mt-1">{selectedPart.partName}</div>
              <div className="text-sm text-text-muted">{selectedPart.partCode} | {t(`comCode.CONSUMABLE_CATEGORY.${selectedPart.category}`, { defaultValue: selectedPart.category })}</div>
              <div className="mt-3 p-2 bg-surface rounded">
                <div className="text-sm text-text-muted">{t('equipment.pm.currentLifeProgress')}</div>
                <LifeProgressBar current={selectedPart.currentShots} expected={selectedPart.expectedLife} />
                <div className="text-xs text-text-muted mt-1">{selectedPart.currentShots.toLocaleString()} / {selectedPart.expectedLife.toLocaleString()} shots</div>
              </div>
            </div>
            <div className="p-4 border border-border rounded-lg">
              <div className="text-sm font-medium text-text mb-2">{t('equipment.pm.afterReplaceSettings')}</div>
              <Input label={t('equipment.pm.newPartCode')} placeholder={t('equipment.pm.newPartCodePlaceholder')} fullWidth />
              <div className="text-xs text-text-muted mt-2">* {t('equipment.pm.replaceNote')}</div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => { setIsReplaceModalOpen(false); setSelectedPart(null); }}>{t('common.cancel')}</Button>
              <Button onClick={handleReplace}><RotateCcw className="w-4 h-4 mr-1" />{t('equipment.pm.registerReplace')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default PmPage;
