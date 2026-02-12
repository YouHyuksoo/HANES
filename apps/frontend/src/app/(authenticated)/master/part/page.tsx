"use client";

/**
 * @file src/pages/master/PartPage.tsx
 * @description 품목 마스터 관리 페이지
 */
import { useState, useMemo } from 'react';
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

const partTypeOptions = [
  { value: '', label: '전체' },
  { value: 'RAW', label: '원자재' },
  { value: 'WIP', label: '반제품' },
  { value: 'FG', label: '완제품' },
];

function PartPage() {
  const [searchText, setSearchText] = useState('');
  const [partTypeFilter, setPartTypeFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);

  const filteredParts = useMemo(() => {
    return mockParts.filter((part) => {
      const matchSearch = !searchText || part.partCode.toLowerCase().includes(searchText.toLowerCase()) || part.partName.toLowerCase().includes(searchText.toLowerCase());
      const matchType = !partTypeFilter || part.partType === partTypeFilter;
      return matchSearch && matchType;
    });
  }, [searchText, partTypeFilter]);

  const columns = useMemo<ColumnDef<Part>[]>(
    () => [
      { accessorKey: 'partCode', header: '품목코드', size: 120 },
      { accessorKey: 'partName', header: '품목명', size: 180 },
      {
        accessorKey: 'partType',
        header: '유형',
        size: 80,
        cell: ({ getValue }) => {
          const typeMap: Record<string, { label: string; color: string }> = {
            RAW: { label: '원자재', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
            WIP: { label: '반제품', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
            FG: { label: '완제품', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
          };
          const type = typeMap[getValue() as string] || { label: getValue(), color: 'bg-gray-100 text-gray-700' };
          return <span className={`px-2 py-1 text-xs rounded-full ${type.color}`}>{type.label}</span>;
        },
      },
      { accessorKey: 'spec', header: '규격', size: 150 },
      { accessorKey: 'unit', header: '단위', size: 60 },
      { accessorKey: 'vendor', header: '공급업체', size: 120 },
      { accessorKey: 'customer', header: '고객사', size: 120 },
      { accessorKey: 'safetyStock', header: '안전재고', size: 80, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
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
    []
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Package className="w-7 h-7 text-primary" />품목 마스터</h1>
          <p className="text-text-muted mt-1">원자재, 반제품, 완제품 품목 정보를 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <Download className="w-4 h-4 mr-1" /> 엑셀 다운로드
          </Button>
          <Button size="sm" onClick={() => { setEditingPart(null); setIsModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> 품목 추가
          </Button>
        </div>
      </div>

      <Card>
        <CardContent>
          {/* 검색 필터 */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="품목코드 또는 품목명으로 검색..."
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
                placeholder="품목 유형"
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
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingPart ? '품목 수정' : '품목 추가'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Input label="품목코드" placeholder="W-001" defaultValue={editingPart?.partCode} fullWidth />
          <Select
            label="품목유형"
            options={partTypeOptions.filter(o => o.value)}
            value={editingPart?.partType || 'RAW'}
            onChange={() => {}}
            fullWidth
          />
          <div className="col-span-2">
            <Input label="품목명" placeholder="전선 AWG18 RED" defaultValue={editingPart?.partName} fullWidth />
          </div>
          <Input label="규격" placeholder="AWG18 1.0sq" defaultValue={editingPart?.spec} fullWidth />
          <Input label="단위" placeholder="M, EA, KG" defaultValue={editingPart?.unit || 'EA'} fullWidth />
          <Input label="공급업체" placeholder="공급업체명" defaultValue={editingPart?.vendor} fullWidth />
          <Input label="고객사" placeholder="고객사명" defaultValue={editingPart?.customer} fullWidth />
          <Input label="안전재고" type="number" placeholder="100" defaultValue={editingPart?.safetyStock?.toString()} fullWidth />
          <Input label="리드타임 (일)" type="number" placeholder="7" fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>취소</Button>
          <Button>{editingPart ? '수정' : '추가'}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default PartPage;
