"use client";

/**
 * @file src/pages/master/ComCodePage.tsx
 * @description 공통코드 관리 페이지
 */
import { useState, useMemo } from 'react';
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
  const [selectedGroup, setSelectedGroup] = useState<string>('PROCESS');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<ComCode | null>(null);

  const filteredCodes = useMemo(() => {
    return mockCodes.filter((code) => code.groupCode === selectedGroup);
  }, [selectedGroup]);

  const columns = useMemo<ColumnDef<ComCode>[]>(
    () => [
      { accessorKey: 'detailCode', header: '상세코드', size: 120 },
      { accessorKey: 'codeName', header: '코드명', size: 150 },
      { accessorKey: 'codeNameEn', header: '영문명', size: 150 },
      { accessorKey: 'sortOrder', header: '정렬순서', size: 80 },
      {
        accessorKey: 'useYn',
        header: '사용여부',
        size: 80,
        cell: ({ getValue }) => (
          <span className={`px-2 py-1 text-xs rounded-full ${getValue() === 'Y' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
            {getValue() === 'Y' ? '사용' : '미사용'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '관리',
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
    []
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Settings className="w-7 h-7 text-primary" />공통코드 관리</h1>
          <p className="text-text-muted mt-1">시스템 전반에서 사용하는 코드를 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
          </Button>
          <Button size="sm" onClick={() => { setEditingCode(null); setIsModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> 코드 추가
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 그룹 목록 */}
        <div className="col-span-3">
          <Card>
            <CardHeader title="그룹 코드" subtitle="코드 그룹을 선택하세요" />
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
            <CardHeader title={`상세 코드 - ${selectedGroup}`} subtitle={`${filteredCodes.length}개의 코드`} />
            <CardContent>
              <DataGrid data={filteredCodes} columns={columns} pageSize={10} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 코드 추가/수정 모달 */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCode ? '코드 수정' : '코드 추가'} size="md">
        <div className="space-y-4">
          <Input label="그룹 코드" value={selectedGroup} disabled fullWidth />
          <Input label="상세 코드" placeholder="예: CUT" defaultValue={editingCode?.detailCode} fullWidth />
          <Input label="코드명" placeholder="예: 절단" defaultValue={editingCode?.codeName} fullWidth />
          <Input label="영문명" placeholder="예: Cutting" defaultValue={editingCode?.codeNameEn} fullWidth />
          <Input label="정렬 순서" type="number" placeholder="1" defaultValue={editingCode?.sortOrder?.toString()} fullWidth />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>취소</Button>
            <Button>{editingCode ? '수정' : '추가'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ComCodePage;
