"use client";

/**
 * @file src/pages/master/BomPage.tsx
 * @description BOM 관리 페이지
 */
import { useState, useMemo } from 'react';
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
  const [selectedParent, setSelectedParent] = useState<ParentPart | null>(mockParents[0]);
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBom, setEditingBom] = useState<BomItem | null>(null);

  const columns = useMemo<ColumnDef<BomItem>[]>(
    () => [
      { accessorKey: 'childPartCode', header: '자품목코드', size: 120 },
      { accessorKey: 'childPartName', header: '자품목명', size: 180 },
      {
        accessorKey: 'childPartType',
        header: '유형',
        size: 80,
        cell: ({ getValue }) => {
          const typeMap: Record<string, { label: string; color: string }> = {
            RAW: { label: '원자재', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
            WIP: { label: '반제품', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
          };
          const type = typeMap[getValue() as string] || { label: getValue(), color: 'bg-gray-100 text-gray-700' };
          return <span className={`px-2 py-1 text-xs rounded-full ${type.color}`}>{type.label}</span>;
        },
      },
      {
        accessorKey: 'qtyPer',
        header: '소요량',
        size: 100,
        cell: ({ row }) => `${row.original.qtyPer} ${row.original.unit}`,
      },
      { accessorKey: 'revision', header: '리비전', size: 80 },
      {
        accessorKey: 'useYn',
        header: '사용',
        size: 60,
        cell: ({ getValue }) => (
          <span className={`w-2 h-2 rounded-full inline-block ${getValue() === 'Y' ? 'bg-green-500' : 'bg-gray-400'}`} />
        ),
      },
      {
        id: 'actions',
        header: '관리',
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
    []
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Layers className="w-7 h-7 text-primary" />BOM 관리</h1>
          <p className="text-text-muted mt-1">제품별 자재 구성(Bill of Materials)을 관리합니다.</p>
        </div>
        <Button size="sm" onClick={() => { setEditingBom(null); setIsModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> BOM 추가
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 부모 품목 목록 */}
        <div className="col-span-4">
          <Card>
            <CardHeader title="부모 품목" subtitle="BOM을 조회할 품목을 선택하세요" />
            <CardContent>
              <Input
                placeholder="품목코드 또는 품목명 검색..."
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
              title={selectedParent ? `BOM - ${selectedParent.partCode}` : 'BOM 상세'}
              subtitle={selectedParent ? `${selectedParent.partName} (${mockBomItems.length}개 자재)` : '부모 품목을 선택하세요'}
            />
            <CardContent>
              {selectedParent ? (
                <DataGrid data={mockBomItems} columns={columns} pageSize={10} />
              ) : (
                <div className="flex items-center justify-center h-64 text-text-muted">
                  좌측에서 부모 품목을 선택하세요
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* BOM 추가/수정 모달 */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingBom ? 'BOM 수정' : 'BOM 추가'} size="md">
        <div className="space-y-4">
          <Input label="부모 품목" value={selectedParent?.partCode || ''} disabled fullWidth />
          <Input label="자품목 코드" placeholder="자품목을 검색하세요" defaultValue={editingBom?.childPartCode} fullWidth />
          <div className="grid grid-cols-2 gap-4">
            <Input label="소요량" type="number" step="0.01" placeholder="1.0" defaultValue={editingBom?.qtyPer?.toString()} fullWidth />
            <Input label="단위" placeholder="EA, M, KG" defaultValue={editingBom?.unit || 'EA'} fullWidth />
          </div>
          <Input label="리비전" placeholder="A" defaultValue={editingBom?.revision || 'A'} fullWidth />
          <Input label="비고" placeholder="비고 입력" fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>취소</Button>
          <Button>{editingBom ? '수정' : '추가'}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default BomPage;
