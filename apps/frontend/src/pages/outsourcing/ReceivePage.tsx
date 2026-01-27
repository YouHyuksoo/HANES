/**
 * @file src/pages/outsourcing/ReceivePage.tsx
 * @description 외주 입고 관리 페이지
 */
import { useState, useMemo } from 'react';
import { Plus, RefreshCw, Search, Package, CheckCircle, XCircle, Layers } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface SubconReceive {
  id: string;
  receiveNo: string;
  orderNo: string;
  vendorName: string;
  partCode: string;
  partName: string;
  qty: number;
  goodQty: number;
  defectQty: number;
  inspectResult: string;
  receiveDate: string;
  workerName: string;
}

const mockData: SubconReceive[] = [
  {
    id: '1',
    receiveNo: 'SCR20250127001',
    orderNo: 'SCO20250127001',
    vendorName: '(주)하네스파트너',
    partCode: 'WH-001',
    partName: '와이어하네스 A타입',
    qty: 500,
    goodQty: 495,
    defectQty: 5,
    inspectResult: 'PARTIAL',
    receiveDate: '2025-01-27 10:30',
    workerName: '김검수',
  },
  {
    id: '2',
    receiveNo: 'SCR20250127002',
    orderNo: 'SCO20250127001',
    vendorName: '(주)하네스파트너',
    partCode: 'WH-001',
    partName: '와이어하네스 A타입',
    qty: 450,
    goodQty: 445,
    defectQty: 5,
    inspectResult: 'PARTIAL',
    receiveDate: '2025-01-27 15:00',
    workerName: '김검수',
  },
  {
    id: '3',
    receiveNo: 'SCR20250126001',
    orderNo: 'SCO20250126001',
    vendorName: '성진커넥터',
    partCode: 'WH-002',
    partName: '와이어하네스 B타입',
    qty: 500,
    goodQty: 500,
    defectQty: 0,
    inspectResult: 'PASS',
    receiveDate: '2025-01-26 11:00',
    workerName: '이검수',
  },
];

const inspectColors: Record<string, string> = {
  PASS: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  PARTIAL: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  FAIL: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const inspectLabels: Record<string, string> = {
  PASS: '합격',
  PARTIAL: '부분합격',
  FAIL: '불합격',
};

function SubconReceivePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = useMemo(() => {
    if (!searchTerm) return mockData;
    return mockData.filter(
      (item) =>
        item.receiveNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.orderNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.partCode.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const columns = useMemo<ColumnDef<SubconReceive>[]>(
    () => [
      { accessorKey: 'receiveNo', header: '입고번호', size: 130 },
      { accessorKey: 'orderNo', header: '발주번호', size: 130 },
      { accessorKey: 'vendorName', header: '외주처', size: 130 },
      { accessorKey: 'partCode', header: '품목코드', size: 90 },
      { accessorKey: 'partName', header: '품목명', size: 140 },
      {
        accessorKey: 'qty',
        header: '입고수량',
        size: 80,
        cell: ({ getValue }) => (getValue() as number).toLocaleString(),
      },
      {
        accessorKey: 'goodQty',
        header: '양품수량',
        size: 80,
        cell: ({ getValue }) => (
          <span className="text-green-600 dark:text-green-400">
            {(getValue() as number).toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: 'defectQty',
        header: '불량수량',
        size: 80,
        cell: ({ getValue }) => {
          const val = getValue() as number;
          return val > 0 ? (
            <span className="text-red-600 dark:text-red-400">{val.toLocaleString()}</span>
          ) : '-';
        },
      },
      {
        accessorKey: 'inspectResult',
        header: '검사결과',
        size: 90,
        cell: ({ getValue }) => {
          const result = getValue() as string;
          return (
            <span className={`px-2 py-1 text-xs rounded-full ${inspectColors[result]}`}>
              {inspectLabels[result]}
            </span>
          );
        },
      },
      { accessorKey: 'receiveDate', header: '입고일시', size: 130 },
      { accessorKey: 'workerName', header: '담당자', size: 80 },
    ],
    []
  );

  const stats = useMemo(() => {
    const totalQty = mockData.reduce((sum, d) => sum + d.qty, 0);
    const totalGood = mockData.reduce((sum, d) => sum + d.goodQty, 0);
    const totalDefect = mockData.reduce((sum, d) => sum + d.defectQty, 0);
    return {
      count: mockData.length,
      totalQty,
      totalGood,
      totalDefect,
      defectRate: totalQty > 0 ? ((totalDefect / totalQty) * 100).toFixed(1) : '0.0',
    };
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Package className="w-7 h-7 text-primary" />외주 입고 관리</h1>
          <p className="text-text-muted mt-1">외주 생산품의 입고 및 검사 현황을 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
          </Button>
          <Button size="sm" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> 입고등록
          </Button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="입고건수" value={stats.count} icon={Package} color="blue" />
        <StatCard label="총 입고수량" value={stats.totalQty.toLocaleString()} icon={Layers} color="purple" />
        <StatCard label="양품수량" value={stats.totalGood.toLocaleString()} icon={CheckCircle} color="green" />
        <StatCard label="불량률" value={`${stats.defectRate}%`} icon={XCircle} color="red" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder="입고번호, 발주번호, 품목코드 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid data={filteredData} columns={columns} pageSize={10} />
        </CardContent>
      </Card>

      {/* 입고등록 모달 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="외주 입고 등록"
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="발주번호"
            options={[
              { value: 'SCO20250127001', label: 'SCO20250127001 - (주)하네스파트너' },
              { value: 'SCO20250125001', label: 'SCO20250125001 - (주)하네스파트너' },
            ]}
            fullWidth
          />
          <div className="p-3 bg-surface rounded-lg">
            <p className="text-sm text-text-muted">품목: WH-001 - 와이어하네스 A타입</p>
            <p className="text-sm text-text-muted">발주수량: 1,000 / 미입고: 50</p>
          </div>
          <Input label="입고수량" type="number" placeholder="50" fullWidth />
          <div className="grid grid-cols-2 gap-4">
            <Input label="양품수량" type="number" placeholder="48" fullWidth />
            <Input label="불량수량" type="number" placeholder="2" fullWidth />
          </div>
          <Select
            label="검사결과"
            options={[
              { value: 'PASS', label: '합격' },
              { value: 'PARTIAL', label: '부분합격' },
              { value: 'FAIL', label: '불합격' },
            ]}
            fullWidth
          />
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

export default SubconReceivePage;
