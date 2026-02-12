"use client";

/**
 * @file src/pages/customs/UsagePage.tsx
 * @description 보세 자재 사용신고 페이지
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw, Search, Send, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface UsageReport {
  id: string;
  reportNo: string;
  lotNo: string;
  partCode: string;
  partName: string;
  usageQty: number;
  usageDate: string;
  reportDate: string | null;
  jobOrderNo: string | null;
  status: string;
  workerName: string;
}

const mockData: UsageReport[] = [
  {
    id: '1',
    reportNo: 'USG20250127001',
    lotNo: 'LOT250125-001',
    partCode: 'WIRE-001',
    partName: '전선 AWG22 적색',
    usageQty: 100,
    usageDate: '2025-01-27 09:30',
    reportDate: '2025-01-27 10:00',
    jobOrderNo: 'JO-2025-001',
    status: 'CONFIRMED',
    workerName: '김작업',
  },
  {
    id: '2',
    reportNo: 'USG20250127002',
    lotNo: 'LOT250125-001',
    partCode: 'WIRE-001',
    partName: '전선 AWG22 적색',
    usageQty: 200,
    usageDate: '2025-01-27 14:00',
    reportDate: null,
    jobOrderNo: 'JO-2025-002',
    status: 'DRAFT',
    workerName: '이작업',
  },
  {
    id: '3',
    reportNo: 'USG20250126001',
    lotNo: 'LOT250124-001',
    partCode: 'TERM-001',
    partName: '단자 250형',
    usageQty: 500,
    usageDate: '2025-01-26 11:00',
    reportDate: '2025-01-26 11:30',
    jobOrderNo: 'JO-2025-001',
    status: 'REPORTED',
    workerName: '박작업',
  },
];

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  REPORTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  CONFIRMED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
};

function CustomsUsagePage() {
  const { t } = useTranslation();

  const statusLabels: Record<string, string> = {
    DRAFT: t('customs.usage.statusDraft'),
    REPORTED: t('customs.usage.statusReported'),
    CONFIRMED: t('customs.usage.statusConfirmed'),
  };
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = useMemo(() => {
    if (!searchTerm) return mockData;
    return mockData.filter(
      (item) =>
        item.reportNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.lotNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.partCode.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const columns = useMemo<ColumnDef<UsageReport>[]>(
    () => [
      { accessorKey: 'reportNo', header: t('customs.usage.reportNo'), size: 130 },
      { accessorKey: 'lotNo', header: t('customs.stock.lotNo'), size: 130 },
      { accessorKey: 'partCode', header: t('common.partCode'), size: 100 },
      { accessorKey: 'partName', header: t('common.partName'), size: 140 },
      {
        accessorKey: 'usageQty',
        header: t('customs.usage.usageQty'),
        size: 90,
        cell: ({ getValue }) => (getValue() as number).toLocaleString(),
      },
      { accessorKey: 'usageDate', header: t('customs.usage.usageDate'), size: 130 },
      {
        accessorKey: 'reportDate',
        header: t('customs.usage.reportDate'),
        size: 130,
        cell: ({ getValue }) => getValue() || '-',
      },
      { accessorKey: 'jobOrderNo', header: t('customs.usage.jobOrder'), size: 110,
        cell: ({ getValue }) => getValue() || '-'
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
      { accessorKey: 'workerName', header: t('customs.usage.worker'), size: 80 },
      {
        id: 'actions',
        header: t('common.manage'),
        size: 80,
        cell: ({ row }) => (
          <div className="flex gap-1">
            {row.original.status === 'DRAFT' && (
              <button className="p-1 hover:bg-surface rounded" title={t('customs.usage.report')}>
                <Send className="w-4 h-4 text-primary" />
              </button>
            )}
            {row.original.status === 'REPORTED' && (
              <button className="p-1 hover:bg-surface rounded" title={t('customs.usage.confirm')}>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </button>
            )}
          </div>
        ),
      },
    ],
    [t]
  );

  // 통계
  const stats = useMemo(() => ({
    total: mockData.length,
    draft: mockData.filter((d) => d.status === 'DRAFT').length,
    reported: mockData.filter((d) => d.status === 'REPORTED').length,
    confirmed: mockData.filter((d) => d.status === 'CONFIRMED').length,
  }), []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Send className="w-7 h-7 text-primary" />{t('customs.usage.title')}</h1>
          <p className="text-text-muted mt-1">{t('customs.usage.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" /> {t('common.refresh')}
          </Button>
          <Button size="sm" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t('customs.usage.registerUsage')}
          </Button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label={t('customs.usage.statusDraft')} value={stats.draft} icon={Clock} color="gray" />
        <StatCard label={t('customs.usage.statusReported')} value={stats.reported} icon={Send} color="blue" />
        <StatCard label={t('customs.usage.statusConfirmed')} value={stats.confirmed} icon={CheckCircle} color="green" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder={t('customs.usage.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid data={filteredData} columns={columns} pageSize={10} />
        </CardContent>
      </Card>

      {/* 등록 모달 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('customs.usage.registerUsage')}
        size="md"
      >
        <div className="space-y-4">
          <Select
            label={t('customs.usage.bondedLot')}
            options={[
              { value: 'LOT250125-001', label: 'LOT250125-001 - 전선 AWG22 적색 (잔여: 700)' },
              { value: 'LOT250125-002', label: 'LOT250125-002 - 전선 AWG22 흑색 (잔여: 500)' },
            ]}
            fullWidth
          />
          <Input label={t('customs.usage.usageQty')} type="number" placeholder="100" fullWidth />
          <Select
            label={t('customs.usage.jobOrder')}
            options={[
              { value: 'JO-2025-001', label: 'JO-2025-001 - 하네스 A타입' },
              { value: 'JO-2025-002', label: 'JO-2025-002 - 하네스 B타입' },
            ]}
            fullWidth
          />
          <Input label={t('common.remark')} placeholder={t('common.remarkPlaceholder')} fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
          <Button>{t('customs.usage.registerAndReport')}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default CustomsUsagePage;
