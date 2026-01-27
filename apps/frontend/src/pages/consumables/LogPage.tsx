/**
 * @file src/pages/consumables/LogPage.tsx
 * @description 소모품 입출고 이력 페이지
 */
import { useState, useMemo } from 'react';
import { Plus, RefreshCw, Search, ArrowDownCircle, ArrowUpCircle, ClipboardList } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface ConsumableLog {
  id: string;
  consumableCode: string;
  consumableName: string;
  logType: string;
  qty: number;
  workerName: string;
  remark: string;
  createdAt: string;
}

const mockData: ConsumableLog[] = [
  {
    id: '1',
    consumableCode: 'MOLD-001',
    consumableName: '압착금형 A타입',
    logType: 'OUT',
    qty: 1,
    workerName: '김작업',
    remark: '압착라인 A 투입',
    createdAt: '2025-01-27 09:00',
  },
  {
    id: '2',
    consumableCode: 'MOLD-001',
    consumableName: '압착금형 A타입',
    logType: 'RETURN',
    qty: 1,
    workerName: '김작업',
    remark: '작업 종료 반납',
    createdAt: '2025-01-27 18:00',
  },
  {
    id: '3',
    consumableCode: 'TOOL-001',
    consumableName: '절단날 표준형',
    logType: 'IN',
    qty: 5,
    workerName: '이관리',
    remark: '신규 입고',
    createdAt: '2025-01-26 10:00',
  },
  {
    id: '4',
    consumableCode: 'TOOL-001',
    consumableName: '절단날 표준형',
    logType: 'SCRAP',
    qty: 2,
    workerName: '박작업',
    remark: '수명 만료 폐기',
    createdAt: '2025-01-26 15:00',
  },
  {
    id: '5',
    consumableCode: 'JIG-001',
    consumableName: '조립지그 001',
    logType: 'REPAIR',
    qty: 1,
    workerName: '최정비',
    remark: '마모부 수리',
    createdAt: '2025-01-25 14:00',
  },
];

const logTypeColors: Record<string, string> = {
  IN: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  OUT: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  RETURN: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  REPAIR: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  SCRAP: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const logTypeLabels: Record<string, string> = {
  IN: '입고',
  OUT: '출고',
  RETURN: '반납',
  REPAIR: '수리',
  SCRAP: '폐기',
};

function ConsumableLogPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const filteredData = useMemo(() => {
    return mockData.filter((item) => {
      const matchSearch = !searchTerm ||
        item.consumableCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.consumableName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = !typeFilter || item.logType === typeFilter;
      return matchSearch && matchType;
    });
  }, [searchTerm, typeFilter]);

  const columns = useMemo<ColumnDef<ConsumableLog>[]>(
    () => [
      { accessorKey: 'createdAt', header: '일시', size: 140 },
      { accessorKey: 'consumableCode', header: '소모품코드', size: 110 },
      { accessorKey: 'consumableName', header: '소모품명', size: 140 },
      {
        accessorKey: 'logType',
        header: '유형',
        size: 80,
        cell: ({ getValue }) => {
          const type = getValue() as string;
          return (
            <span className={`px-2 py-1 text-xs rounded-full ${logTypeColors[type]}`}>
              {logTypeLabels[type]}
            </span>
          );
        },
      },
      {
        accessorKey: 'qty',
        header: '수량',
        size: 70,
        cell: ({ row }) => {
          const type = row.original.logType;
          const isIn = type === 'IN' || type === 'RETURN';
          return (
            <span className={isIn ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
              {isIn ? '+' : '-'}{row.original.qty}
            </span>
          );
        },
      },
      { accessorKey: 'workerName', header: '작업자', size: 80 },
      { accessorKey: 'remark', header: '비고', size: 180 },
    ],
    []
  );

  const stats = useMemo(() => ({
    inCount: mockData.filter((d) => d.logType === 'IN').length,
    outCount: mockData.filter((d) => d.logType === 'OUT').length,
    returnCount: mockData.filter((d) => d.logType === 'RETURN').length,
  }), []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><ClipboardList className="w-7 h-7 text-primary" />입출고 이력</h1>
          <p className="text-text-muted mt-1">소모품의 입출고 이력을 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
          </Button>
          <Button size="sm" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> 이력 등록
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="입고" value={stats.inCount} icon={ArrowDownCircle} color="green" />
        <StatCard label="출고" value={stats.outCount} icon={ArrowUpCircle} color="blue" />
        <StatCard label="반납" value={stats.returnCount} icon={ArrowDownCircle} color="purple" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder="소모품코드, 명칭 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <Select options={[{ value: '', label: '전체 유형' }, { value: 'IN', label: '입고' }, { value: 'OUT', label: '출고' }, { value: 'RETURN', label: '반납' }, { value: 'REPAIR', label: '수리' }, { value: 'SCRAP', label: '폐기' }]} value={typeFilter} onChange={setTypeFilter} placeholder="유형" />
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid data={filteredData} columns={columns} pageSize={10} />
        </CardContent>
      </Card>

      {/* 등록 모달 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="입출고 이력 등록"
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="소모품"
            options={[
              { value: 'MOLD-001', label: 'MOLD-001 - 압착금형 A타입' },
              { value: 'MOLD-002', label: 'MOLD-002 - 압착금형 B타입' },
              { value: 'JIG-001', label: 'JIG-001 - 조립지그 001' },
              { value: 'TOOL-001', label: 'TOOL-001 - 절단날 표준형' },
            ]}
            fullWidth
          />
          <Select
            label="유형"
            options={[
              { value: 'IN', label: '입고' },
              { value: 'OUT', label: '출고' },
              { value: 'RETURN', label: '반납' },
              { value: 'REPAIR', label: '수리' },
              { value: 'SCRAP', label: '폐기' },
            ]}
            fullWidth
          />
          <Input label="수량" type="number" placeholder="1" fullWidth />
          <Input label="비고" placeholder="비고 입력" fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>취소</Button>
          <Button>등록</Button>
        </div>
      </Modal>
    </div>
  );
}

export default ConsumableLogPage;
