"use client";

/**
 * @file src/pages/outsourcing/ReceivePage.tsx
 * @description 외주 입고 관리 페이지
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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

function SubconReceivePage() {
  const { t } = useTranslation();

  const inspectLabels: Record<string, string> = {
    PASS: t('outsourcing.receive.inspectPass'),
    PARTIAL: t('outsourcing.receive.inspectPartial'),
    FAIL: t('outsourcing.receive.inspectFail'),
  };
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
      { accessorKey: 'receiveNo', header: t('outsourcing.receive.receiveNo'), size: 130 },
      { accessorKey: 'orderNo', header: t('outsourcing.order.orderNo'), size: 130 },
      { accessorKey: 'vendorName', header: t('outsourcing.order.vendor'), size: 130 },
      { accessorKey: 'partCode', header: t('common.partCode'), size: 90 },
      { accessorKey: 'partName', header: t('common.partName'), size: 140 },
      {
        accessorKey: 'qty',
        header: t('outsourcing.receive.receiveQty'),
        size: 80,
        cell: ({ getValue }) => (getValue() as number).toLocaleString(),
      },
      {
        accessorKey: 'goodQty',
        header: t('outsourcing.receive.goodQty'),
        size: 80,
        cell: ({ getValue }) => (
          <span className="text-green-600 dark:text-green-400">
            {(getValue() as number).toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: 'defectQty',
        header: t('outsourcing.receive.defectQty'),
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
        header: t('outsourcing.receive.inspectResult'),
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
      { accessorKey: 'receiveDate', header: t('outsourcing.receive.receiveDate'), size: 130 },
      { accessorKey: 'workerName', header: t('outsourcing.receive.worker'), size: 80 },
    ],
    [t]
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
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Package className="w-7 h-7 text-primary" />{t('outsourcing.receive.title')}</h1>
          <p className="text-text-muted mt-1">{t('outsourcing.receive.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" /> {t('common.refresh')}
          </Button>
          <Button size="sm" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t('outsourcing.receive.register')}
          </Button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t('outsourcing.receive.receiveCount')} value={stats.count} icon={Package} color="blue" />
        <StatCard label={t('outsourcing.receive.totalReceiveQty')} value={stats.totalQty.toLocaleString()} icon={Layers} color="purple" />
        <StatCard label={t('outsourcing.receive.goodQty')} value={stats.totalGood.toLocaleString()} icon={CheckCircle} color="green" />
        <StatCard label={t('outsourcing.receive.defectRate')} value={`${stats.defectRate}%`} icon={XCircle} color="red" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder={t('outsourcing.receive.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
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
        title={t('outsourcing.receive.register')}
        size="md"
      >
        <div className="space-y-4">
          <Select
            label={t('outsourcing.order.orderNo')}
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
          <Input label={t('outsourcing.receive.receiveQty')} type="number" placeholder="50" fullWidth />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('outsourcing.receive.goodQty')} type="number" placeholder="48" fullWidth />
            <Input label={t('outsourcing.receive.defectQty')} type="number" placeholder="2" fullWidth />
          </div>
          <Select
            label={t('outsourcing.receive.inspectResult')}
            options={[
              { value: 'PASS', label: t('outsourcing.receive.inspectPass') },
              { value: 'PARTIAL', label: t('outsourcing.receive.inspectPartial') },
              { value: 'FAIL', label: t('outsourcing.receive.inspectFail') },
            ]}
            fullWidth
          />
          <Input label={t('common.remark')} placeholder={t('common.remarkPlaceholder')} fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
          <Button>{t('common.register')}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default SubconReceivePage;
