"use client";

/**
 * @file src/components/production/JobOrderSelectModal.tsx
 * @description 작업지시 선택 모달 — 실 API 연동
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search, Check } from 'lucide-react';
import { Modal, Input, Button } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { ComCodeBadge } from '@/components/ui';
import api from '@/services/api';

export interface JobOrder {
  id: string;
  orderNo: string;
  itemCode: string;
  itemName: string;
  itemType?: string;
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

export default function JobOrderSelectModal({
  isOpen,
  onClose,
  onConfirm,
  filterStatus = ['WAITING', 'RUNNING'],
}: JobOrderSelectModalProps) {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [selectedJobOrder, setSelectedJobOrder] = useState<JobOrder | null>(null);
  const [rawData, setRawData] = useState<JobOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchJobOrders = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const statuses = filterStatus.join(',');
      const res = await api.get('/production/job-orders', {
        params: { statuses, limit: 200 },
      });
      const items: JobOrder[] = (res.data?.data ?? []).map((jo: Record<string, unknown>) => {
        const part = jo.part as Record<string, unknown> | undefined;
        return {
          id: jo.orderNo as string,
          orderNo: jo.orderNo as string,
          itemCode: jo.itemCode as string,
          itemName: (part?.itemName ?? jo.itemCode) as string,
          itemType: part?.itemType as string | undefined,
          processType: jo.processType as string | undefined,
          processCode: jo.processCode as string | undefined,
          planQty: jo.planQty as number,
          completedQty: (jo.goodQty ?? 0) as number,
          status: jo.status as string,
          planStartDate: jo.planDate ? String(jo.planDate).slice(0, 10) : '',
          planEndDate: jo.planDate ? String(jo.planDate).slice(0, 10) : '',
          workDate: jo.planDate ? String(jo.planDate).slice(0, 10) : undefined,
        };
      });
      setRawData(items);
    } catch {
      setRawData([]);
    } finally {
      setLoading(false);
    }
  }, [isOpen, filterStatus]);

  useEffect(() => {
    if (isOpen) {
      setSelectedJobOrder(null);
      setSearchText('');
      fetchJobOrders();
    }
  }, [isOpen, fetchJobOrders]);

  const filteredData = useMemo(() => {
    if (!searchText) return rawData;
    const s = searchText.toLowerCase();
    return rawData.filter(
      (item) =>
        item.orderNo.toLowerCase().includes(s) ||
        item.itemCode.toLowerCase().includes(s) ||
        item.itemName.toLowerCase().includes(s) ||
        (item.processCode?.toLowerCase().includes(s) ?? false),
    );
  }, [rawData, searchText]);

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
        accessorKey: 'itemName',
        header: t('common.partName'),
        size: 180,
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.itemName}</div>
            <div className="text-xs text-text-muted">{row.original.itemCode}</div>
          </div>
        ),
      },
      {
        accessorKey: 'processType',
        header: t('production.order.process'),
        size: 100,
        cell: ({ getValue }) => (
          <ComCodeBadge groupCode="PROCESS_TYPE" code={getValue() as string} />
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
              {row.original.planQty > 0
                ? Math.round((row.original.completedQty / row.original.planQty) * 100)
                : 0}%
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: t('common.status'),
        size: 90,
        cell: ({ getValue }) => (
          <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={getValue() as string} />
        ),
      },
      {
        accessorKey: 'planStartDate',
        header: t('production.order.planDate'),
        size: 110,
        meta: { filterType: 'date' },
        cell: ({ row }) => (
          <span className="text-sm text-text-muted">{row.original.planStartDate}</span>
        ),
      },
    ],
    [t, selectedJobOrder],
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('production.inputManual.selectJobOrder')} size="xl">
      <div className="space-y-4">
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

        <div className="border border-border rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-text-muted text-sm">
              {t('common.loading', '불러오는 중...')}
            </div>
          ) : (
            <DataGrid data={filteredData} columns={columns} pageSize={5} />
          )}
        </div>

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
                <span className="ml-2 font-medium">{selectedJobOrder.itemName}</span>
              </div>
              <div>
                <span className="text-text-muted">{t('production.order.process')}:</span>
                <span className="ml-2">
                  <ComCodeBadge groupCode="PROCESS_TYPE" code={selectedJobOrder.processType || ''} />
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
