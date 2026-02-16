"use client";

/**
 * @file src/pages/customs/StockPage.tsx
 * @description 보세 자재 재고 현황 페이지
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Download, Search, Package } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { createPartColumns } from '@/lib/table-utils';
import { ColumnDef } from '@tanstack/react-table';

interface CustomsLot {
  id: string;
  entryNo: string;
  lotNo: string;
  partCode: string;
  partName: string;
  origin: string;
  qty: number;
  usedQty: number;
  remainQty: number;
  status: string;
  declarationDate: string;
}

const mockData: CustomsLot[] = [
  {
    id: '1',
    entryNo: 'IMP20250125001',
    lotNo: 'LOT250125-001',
    partCode: 'WIRE-001',
    partName: '전선 AWG22 적색',
    origin: 'CN',
    qty: 1000,
    usedQty: 300,
    remainQty: 700,
    status: 'PARTIAL',
    declarationDate: '2025-01-25',
  },
  {
    id: '2',
    entryNo: 'IMP20250125001',
    lotNo: 'LOT250125-002',
    partCode: 'WIRE-002',
    partName: '전선 AWG22 흑색',
    origin: 'CN',
    qty: 500,
    usedQty: 0,
    remainQty: 500,
    status: 'BONDED',
    declarationDate: '2025-01-25',
  },
  {
    id: '3',
    entryNo: 'IMP20250124001',
    lotNo: 'LOT250124-001',
    partCode: 'TERM-001',
    partName: '단자 250형',
    origin: 'JP',
    qty: 5000,
    usedQty: 5000,
    remainQty: 0,
    status: 'RELEASED',
    declarationDate: '2025-01-24',
  },
];

const statusColors: Record<string, string> = {
  BONDED: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  PARTIAL: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  RELEASED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
};

function CustomsStockPage() {
  const { t } = useTranslation();

  const statusLabels: Record<string, string> = {
    BONDED: t('customs.stock.statusBonded'),
    PARTIAL: t('customs.stock.statusPartial'),
    RELEASED: t('customs.stock.statusReleased'),
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const filteredData = useMemo(() => {
    return mockData.filter((item) => {
      const matchSearch = !searchTerm ||
        item.lotNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.partCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.partName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = !statusFilter || item.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [searchTerm, statusFilter]);

  const columns = useMemo<ColumnDef<CustomsLot>[]>(
    () => [
      { accessorKey: 'entryNo', header: t('customs.entry.entryNo'), size: 140 },
      { accessorKey: 'lotNo', header: t('customs.stock.lotNo'), size: 130 },
      ...createPartColumns<CustomsLot>(t),
      { accessorKey: 'origin', header: t('customs.entry.origin'), size: 70 },
      {
        accessorKey: 'qty',
        header: t('customs.stock.receivedQty'),
        size: 90,
        cell: ({ getValue }) => (getValue() as number).toLocaleString(),
      },
      {
        accessorKey: 'usedQty',
        header: t('customs.stock.usedQty'),
        size: 90,
        cell: ({ getValue }) => (getValue() as number).toLocaleString(),
      },
      {
        accessorKey: 'remainQty',
        header: t('customs.stock.remainQty'),
        size: 90,
        cell: ({ getValue }) => {
          const val = getValue() as number;
          return (
            <span className={val === 0 ? 'text-text-muted' : 'font-semibold text-primary'}>
              {val.toLocaleString()}
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: t('common.status'),
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
      { accessorKey: 'declarationDate', header: t('customs.entry.declarationDate'), size: 100 },
    ],
    [t]
  );

  // 통계 계산
  const stats = useMemo(() => {
    const bondedLots = mockData.filter((d) => d.status !== 'RELEASED');
    const totalRemain = bondedLots.reduce((sum, d) => sum + d.remainQty, 0);
    return {
      totalLots: mockData.length,
      bondedLots: bondedLots.length,
      totalRemain,
    };
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Package className="w-7 h-7 text-primary" />{t('customs.stock.title')}</h1>
          <p className="text-text-muted mt-1">{t('customs.stock.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <Download className="w-4 h-4 mr-1" /> {t('common.excel')}
          </Button>
          <Button variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" /> {t('common.refresh')}
          </Button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label={t('customs.stock.totalLots')} value={stats.totalLots} icon={Package} color="blue" />
        <StatCard label={t('customs.stock.bondedLots')} value={stats.bondedLots} icon={Package} color="purple" />
        <StatCard label={t('customs.stock.totalRemain')} value={stats.totalRemain.toLocaleString()} icon={Package} color="green" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder={t('customs.stock.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <Select options={[{ value: '', label: t('common.allStatus') }, { value: 'BONDED', label: t('customs.stock.statusBonded') }, { value: 'PARTIAL', label: t('customs.stock.statusPartial') }, { value: 'RELEASED', label: t('customs.stock.statusReleased') }]} value={statusFilter} onChange={setStatusFilter} placeholder={t('common.status')} />
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid data={filteredData} columns={columns} pageSize={10} />
        </CardContent>
      </Card>
    </div>
  );
}

export default CustomsStockPage;
