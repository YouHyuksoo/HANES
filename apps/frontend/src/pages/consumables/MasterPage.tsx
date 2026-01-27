/**
 * @file src/pages/consumables/MasterPage.tsx
 * @description 소모품 마스터 관리 페이지
 */
import { useState, useMemo } from 'react';
import { Plus, Edit2, RefreshCw, Search, Wrench, AlertTriangle, XCircle } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface Consumable {
  id: string;
  consumableCode: string;
  name: string;
  category: string;
  expectedLife: number;
  currentCount: number;
  warningCount: number;
  location: string;
  vendor: string;
  status: string;
  lifePercentage: number;
}

const mockData: Consumable[] = [
  {
    id: '1',
    consumableCode: 'MOLD-001',
    name: '압착금형 A타입',
    category: 'MOLD',
    expectedLife: 100000,
    currentCount: 85000,
    warningCount: 80000,
    location: '금형창고 A-1',
    vendor: '금형공업',
    status: 'WARNING',
    lifePercentage: 85,
  },
  {
    id: '2',
    consumableCode: 'MOLD-002',
    name: '압착금형 B타입',
    category: 'MOLD',
    expectedLife: 100000,
    currentCount: 45000,
    warningCount: 80000,
    location: '금형창고 A-2',
    vendor: '금형공업',
    status: 'NORMAL',
    lifePercentage: 45,
  },
  {
    id: '3',
    consumableCode: 'JIG-001',
    name: '조립지그 001',
    category: 'JIG',
    expectedLife: 50000,
    currentCount: 48000,
    warningCount: 40000,
    location: '조립라인 B',
    vendor: 'JIG제작소',
    status: 'WARNING',
    lifePercentage: 96,
  },
  {
    id: '4',
    consumableCode: 'TOOL-001',
    name: '절단날 표준형',
    category: 'TOOL',
    expectedLife: 10000,
    currentCount: 10500,
    warningCount: 8000,
    location: '공구창고',
    vendor: '공구상사',
    status: 'REPLACE',
    lifePercentage: 105,
  },
];

const categoryLabels: Record<string, string> = {
  MOLD: '금형',
  JIG: '지그',
  TOOL: '공구',
};

const statusColors: Record<string, string> = {
  NORMAL: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  WARNING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  REPLACE: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const statusLabels: Record<string, string> = {
  NORMAL: '정상',
  WARNING: '경고',
  REPLACE: '교체필요',
};

function ConsumableMasterPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Consumable | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const filteredData = useMemo(() => {
    return mockData.filter((item) => {
      const matchSearch = !searchTerm ||
        item.consumableCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = !categoryFilter || item.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [searchTerm, categoryFilter]);

  const columns = useMemo<ColumnDef<Consumable>[]>(
    () => [
      { accessorKey: 'consumableCode', header: '소모품코드', size: 110 },
      { accessorKey: 'name', header: '소모품명', size: 140 },
      {
        accessorKey: 'category',
        header: '분류',
        size: 70,
        cell: ({ getValue }) => categoryLabels[getValue() as string],
      },
      {
        accessorKey: 'currentCount',
        header: '현재타수',
        size: 90,
        cell: ({ getValue }) => (getValue() as number).toLocaleString(),
      },
      {
        accessorKey: 'expectedLife',
        header: '기대수명',
        size: 90,
        cell: ({ getValue }) => (getValue() as number).toLocaleString(),
      },
      {
        accessorKey: 'lifePercentage',
        header: '수명',
        size: 120,
        cell: ({ row }) => {
          const pct = row.original.lifePercentage;
          const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-green-500';
          return (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <span className="text-xs text-text-muted w-10">{pct}%</span>
            </div>
          );
        },
      },
      { accessorKey: 'location', header: '보관위치', size: 100 },
      { accessorKey: 'vendor', header: '공급업체', size: 90 },
      {
        accessorKey: 'status',
        header: '상태',
        size: 90,
        cell: ({ getValue }) => {
          const status = getValue() as string;
          return (
            <span className={`px-2 py-1 text-xs rounded-full ${statusColors[status]}`}>
              {statusLabels[status]}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: '관리',
        size: 80,
        cell: ({ row }) => (
          <button
            onClick={() => { setSelectedItem(row.original); setIsModalOpen(true); }}
            className="p-1 hover:bg-surface rounded"
          >
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
        ),
      },
    ],
    []
  );

  const stats = useMemo(() => ({
    total: mockData.length,
    warning: mockData.filter((d) => d.status === 'WARNING').length,
    replace: mockData.filter((d) => d.status === 'REPLACE').length,
  }), []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Wrench className="w-7 h-7 text-primary" />소모품 마스터</h1>
          <p className="text-text-muted mt-1">금형, 지그, 공구 등 소모품을 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
          </Button>
          <Button size="sm" onClick={() => { setSelectedItem(null); setIsModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> 소모품 등록
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="전체 소모품" value={stats.total} icon={Wrench} color="blue" />
        <StatCard label="경고" value={stats.warning} icon={AlertTriangle} color="yellow" />
        <StatCard label="교체필요" value={stats.replace} icon={XCircle} color="red" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder="코드, 명칭 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <Select options={[{ value: '', label: '전체 분류' }, { value: 'MOLD', label: '금형' }, { value: 'JIG', label: '지그' }, { value: 'TOOL', label: '공구' }]} value={categoryFilter} onChange={setCategoryFilter} placeholder="분류" />
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid data={filteredData} columns={columns} pageSize={10} />
        </CardContent>
      </Card>

      {/* 등록/수정 모달 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedItem ? '소모품 수정' : '소모품 등록'}
        size="md"
      >
        <div className="grid grid-cols-2 gap-4">
          <Input label="소모품 코드" placeholder="MOLD-001" defaultValue={selectedItem?.consumableCode} fullWidth />
          <Select
            label="분류"
            options={[
              { value: 'MOLD', label: '금형' },
              { value: 'JIG', label: '지그' },
              { value: 'TOOL', label: '공구' },
            ]}
            defaultValue={selectedItem?.category || 'MOLD'}
            fullWidth
          />
          <Input label="소모품명" placeholder="압착금형 A타입" defaultValue={selectedItem?.name} fullWidth className="col-span-2" />
          <Input label="기대수명 (타수)" type="number" placeholder="100000" defaultValue={selectedItem?.expectedLife?.toString()} fullWidth />
          <Input label="경고임계치" type="number" placeholder="80000" defaultValue={selectedItem?.warningCount?.toString()} fullWidth />
          <Input label="보관위치" placeholder="금형창고 A-1" defaultValue={selectedItem?.location} fullWidth />
          <Input label="공급업체" placeholder="금형공업" defaultValue={selectedItem?.vendor} fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>취소</Button>
          <Button>{selectedItem ? '수정' : '등록'}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default ConsumableMasterPage;
