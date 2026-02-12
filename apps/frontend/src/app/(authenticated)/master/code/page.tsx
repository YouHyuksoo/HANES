"use client";

/**
 * @file src/pages/master/ComCodePage.tsx
 * @description 공통코드 관리 페이지
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, RefreshCw, Settings } from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Input, Modal } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface ComCode {
  id: string;
  groupCode: string;
  detailCode: string;
  codeName: string;
  codeNameEn?: string;
  sortOrder: number;
  useYn: string;
}

// Mock 데이터
const mockGroups = [
  { groupCode: 'PROCESS', count: 5 },
  { groupCode: 'DEFECT', count: 8 },
  { groupCode: 'WAREHOUSE', count: 4 },
  { groupCode: 'UNIT', count: 6 },
  { groupCode: 'STATUS', count: 3 },
];

const mockCodes: ComCode[] = [
  { id: '1', groupCode: 'PROCESS', detailCode: 'CUT', codeName: '절단', codeNameEn: 'Cutting', sortOrder: 1, useYn: 'Y' },
  { id: '2', groupCode: 'PROCESS', detailCode: 'CRM', codeName: '압착', codeNameEn: 'Crimping', sortOrder: 2, useYn: 'Y' },
  { id: '3', groupCode: 'PROCESS', detailCode: 'ASM', codeName: '조립', codeNameEn: 'Assembly', sortOrder: 3, useYn: 'Y' },
  { id: '4', groupCode: 'PROCESS', detailCode: 'INS', codeName: '검사', codeNameEn: 'Inspection', sortOrder: 4, useYn: 'Y' },
  { id: '5', groupCode: 'PROCESS', detailCode: 'PKG', codeName: '포장', codeNameEn: 'Packing', sortOrder: 5, useYn: 'Y' },
];

function ComCodePage() {
  const { t } = useTranslation();
  const [selectedGroup, setSelectedGroup] = useState<string>('PROCESS');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<ComCode | null>(null);

  const filteredCodes = useMemo(() => {
    return mockCodes.filter((code) => code.groupCode === selectedGroup);
  }, [selectedGroup]);

  const columns = useMemo<ColumnDef<ComCode>[]>(
    () => [
      { accessorKey: 'detailCode', header: t('master.code.detailCode'), size: 120 },
      { accessorKey: 'codeName', header: t('master.code.codeName'), size: 150 },
      { accessorKey: 'codeNameEn', header: t('master.code.codeNameEn'), size: 150 },
      { accessorKey: 'sortOrder', header: t('master.code.sortOrder'), size: 80 },
      {
        accessorKey: 'useYn',
        header: t('master.code.useYn'),
        size: 80,
        cell: ({ getValue }) => (
          <span className={`px-2 py-1 text-xs rounded-full ${getValue() === 'Y' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
            {getValue() === 'Y' ? t('master.code.inUse') : t('master.code.notInUse')}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('common.actions'),
        size: 100,
        cell: ({ row }) => (
          <div className="flex gap-1">
            <button onClick={() => { setEditingCode(row.original); setIsModalOpen(true); }} className="p-1 hover:bg-surface rounded">
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
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Settings className="w-7 h-7 text-primary" />{t('master.code.title')}</h1>
          <p className="text-text-muted mt-1">{t('master.code.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" /> {t('common.refresh')}
          </Button>
          <Button size="sm" onClick={() => { setEditingCode(null); setIsModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> {t('master.code.addCode')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 그룹 목록 */}
        <div className="col-span-3">
          <Card>
            <CardHeader title={t('master.code.groupCode')} subtitle={t('master.code.selectGroup')} />
            <CardContent>
              <div className="space-y-1">
                {mockGroups.map((group) => (
                  <button
                    key={group.groupCode}
                    onClick={() => setSelectedGroup(group.groupCode)}
                    className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-sm transition-colors ${selectedGroup === group.groupCode ? 'bg-primary text-white' : 'hover:bg-surface text-text'}`}
                  >
                    <span>{group.groupCode}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${selectedGroup === group.groupCode ? 'bg-white/20 text-white' : 'bg-surface text-text-muted'}`}>
                      {group.count}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 상세 코드 목록 */}
        <div className="col-span-9">
          <Card>
            <CardHeader title={`${t('master.code.detailCode')} - ${selectedGroup}`} subtitle={`${filteredCodes.length}${t('master.code.codesCount')}`} />
            <CardContent>
              <DataGrid data={filteredCodes} columns={columns} pageSize={10} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 코드 추가/수정 모달 */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCode ? t('master.code.editCode') : t('master.code.addCode')} size="md">
        <div className="space-y-4">
          <Input label={t('master.code.groupCode')} value={selectedGroup} disabled fullWidth />
          <Input label={t('master.code.detailCode')} placeholder={t('master.code.detailCodePlaceholder')} defaultValue={editingCode?.detailCode} fullWidth />
          <Input label={t('master.code.codeName')} placeholder={t('master.code.codeNamePlaceholder')} defaultValue={editingCode?.codeName} fullWidth />
          <Input label={t('master.code.codeNameEn')} placeholder={t('master.code.codeNameEnPlaceholder')} defaultValue={editingCode?.codeNameEn} fullWidth />
          <Input label={t('master.code.sortOrder')} type="number" placeholder="1" defaultValue={editingCode?.sortOrder?.toString()} fullWidth />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
            <Button>{editingCode ? t('common.edit') : t('common.add')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ComCodePage;
