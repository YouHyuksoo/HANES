"use client";

/**
 * @file src/components/production/JobOrderSelectModal.tsx
 * @description 작업지시 선택 모달
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search, Calendar, Package, Check } from 'lucide-react';
import { Modal, Input, Button } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { ComCodeBadge } from '@/components/ui';

export interface JobOrder {
  id: string;
  orderNo: string;
  partCode: string;
  partName: string;
  partType?: string;
  processType?: string;
  processCode?: string;
  planQty: number;
  completedQty: number;
  status: string;
  planStartDate: string;
  planEndDate: string;
  workDate?: string;
  equipCode?: string;
  equipName?: string;
}

interface JobOrderSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (jobOrder: JobOrder) => void;
  filterStatus?: string[];
}

// Mock data - 실제로는 API에서 조회
const mockJobOrders: JobOrder[] = [
  { id: '1', orderNo: 'JO-20250217-001', partCode: 'HNS-001', partName: '메인 하네스 A', partType: 'FG', processType: 'CUT', processCode: 'CUT-01', planQty: 1000, completedQty: 500, status: 'IN_PROGRESS', planStartDate: '2025-02-17', planEndDate: '2025-02-18', workDate: '2025-02-17', equipCode: 'EQ-001', equipName: '절단기 1호' },
  { id: '2', orderNo: 'JO-20250217-002', partCode: 'HNS-002', partName: '서브 하네스 B', partType: 'WIP', processType: 'CRM', processCode: 'CRM-01', planQty: 800, completedQty: 0, status: 'READY', planStartDate: '2025-02-17', planEndDate: '2025-02-17', workDate: '2025-02-17', equipCode: 'EQ-002', equipName: '압착기 1호' },
  { id: '3', orderNo: 'JO-20250216-001', partCode: 'HNS-001', partName: '메인 하네스 A', partType: 'FG', processType: 'ASM', processCode: 'ASM-01', planQty: 500, completedQty: 500, status: 'COMPLETED', planStartDate: '2025-02-16', planEndDate: '2025-02-16', workDate: '2025-02-16', equipCode: 'EQ-003', equipName: '조립라인 A' },
  { id: '4', orderNo: 'JO-20250217-003', partCode: 'HNS-003', partName: '도어 하네스 C', partType: 'FG', processType: 'CUT', processCode: 'CUT-02', planQty: 600, completedQty: 200, status: 'IN_PROGRESS', planStartDate: '2025-02-17', planEndDate: '2025-02-19', workDate: '2025-02-17', equipCode: 'EQ-001', equipName: '절단기 1호' },
  { id: '5', orderNo: 'JO-20250215-001', partCode: 'HNS-004', partName: '트렁크 하네스', partType: 'FG', processType: 'INS', processCode: 'INS-01', planQty: 300, completedQty: 300, status: 'COMPLETED', planStartDate: '2025-02-15', planEndDate: '2025-02-15', workDate: '2025-02-15', equipCode: 'EQ-004', equipName: '검사라인' },
];

export default function JobOrderSelectModal({
  isOpen,
  onClose,
  onConfirm,
  filterStatus = ['READY', 'IN_PROGRESS'],
}: JobOrderSelectModalProps) {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [selectedJobOrder, setSelectedJobOrder] = useState<JobOrder | null>(null);

  const filteredData = useMemo(() => {
    return mockJobOrders
      .filter((item) => filterStatus.includes(item.status))
      .filter((item) => {
        if (!searchText) return true;
        const search = searchText.toLowerCase();
        return (
          item.orderNo.toLowerCase().includes(search) ||
          item.partCode.toLowerCase().includes(search) ||
          item.partName.toLowerCase().includes(search) ||
          (item.processCode?.toLowerCase().includes(search) ?? false)
        );
      });
  }, [searchText, filterStatus]);

  const handleConfirm = () => {
    if (selectedJobOrder) {
      onConfirm(selectedJobOrder);
      setSelectedJobOrder(null);
      setSearchText('');
    }
  };

  const handleClose = () => {
    setSelectedJobOrder(null);
    setSearchText('');
    onClose();
  };

  const columns = useMemo<ColumnDef<JobOrder>[]>(
    () => [
      {
        id: 'select',
        header: '',
        size: 50,
        cell: ({ row }) => (
          <button
            onClick={() => setSelectedJobOrder(row.original)}
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
              selectedJobOrder?.id === row.original.id
                ? 'bg-primary border-primary'
                : 'border-border hover:border-primary/50'
            }`}
          >
            {selectedJobOrder?.id === row.original.id && (
              <Check className="w-4 h-4 text-white" />
            )}
          </button>
        ),
      },
      {
        accessorKey: 'orderNo',
        header: t('production.order.orderNo'),
        size: 160,
        cell: ({ getValue }) => (
          <span className="font-mono text-sm font-medium">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: 'partName',
        header: t('common.partName'),
        size: 180,
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.partName}</div>
            <div className="text-xs text-text-muted">{row.original.partCode}</div>
          </div>
        ),
      },
      {
        accessorKey: 'processType',
        header: t('production.order.process'),
        size: 100,
        cell: ({ getValue }) => (
          <ComCodeBadge
            groupCode="PROCESS_TYPE"
            code={getValue() as string}
          />
        ),
      },
      {
        accessorKey: 'planQty',
        header: t('production.order.planQty'),
        size: 100,
        meta: { filterType: 'number' },
        cell: ({ row }) => (
          <div className="text-right">
            <div className="font-medium">
              {row.original.completedQty.toLocaleString()} / {row.original.planQty.toLocaleString()}
            </div>
            <div className="text-xs text-text-muted">
              {Math.round((row.original.completedQty / row.original.planQty) * 100)}%
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: t('common.status'),
        size: 90,
        cell: ({ getValue }) => (
          <ComCodeBadge
            groupCode="JOB_ORDER_STATUS"
            code={getValue() as string}
          />
        ),
      },
      {
        accessorKey: 'planStartDate',
        header: t('production.order.planDate'),
        size: 110,
        meta: { filterType: 'date' },
        cell: ({ row }) => (
          <span className="text-sm text-text-muted">
            {row.original.planStartDate} ~ {row.original.planEndDate}
          </span>
        ),
      },
    ],
    [t, selectedJobOrder]
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('production.inputManual.selectJobOrder')} size="xl">
      <div className="space-y-4">
        {/* 검색 */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder={t('production.inputManual.searchJobOrderPlaceholder')}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              fullWidth
            />
          </div>
        </div>

        {/* 작업지시 목록 */}
        <div className="border border-border rounded-lg overflow-hidden">
          <DataGrid
            data={filteredData}
            columns={columns}
            pageSize={5}
          />
        </div>

        {/* 선택된 작업지시 정보 */}
        {selectedJobOrder && (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-5 h-5 text-primary" />
              <span className="font-semibold text-text">
                {t('production.inputManual.selectedJobOrder')}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-text-muted">{t('production.order.orderNo')}:</span>
                <span className="ml-2 font-mono font-medium">{selectedJobOrder.orderNo}</span>
              </div>
              <div>
                <span className="text-text-muted">{t('common.partName')}:</span>
                <span className="ml-2 font-medium">{selectedJobOrder.partName}</span>
              </div>
              <div>
                <span className="text-text-muted">{t('production.order.process')}:</span>
                <span className="ml-2">
                  <ComCodeBadge
                    groupCode="PROCESS_TYPE"
                    code={selectedJobOrder.processType || ''}
                  />
                </span>
              </div>
              <div>
                <span className="text-text-muted">{t('production.order.planQty')}:</span>
                <span className="ml-2">
                  {selectedJobOrder.completedQty.toLocaleString()} / {selectedJobOrder.planQty.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="secondary" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedJobOrder}>
            <Check className="w-4 h-4 mr-1" />
            {t('common.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
