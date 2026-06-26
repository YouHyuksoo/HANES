"use client";

/**
 * @file src/components/production/JobOrderSelectModal.tsx
 * @description 작업지시 선택 모달 — 실 API 연동
 *
 * - 현재 설비(equipCode)에 배당된 작업지시만 선택 가능
 * - 다른 설비 배당 건은 그레이 표시, 선택 불가
 * - "현재 설비만" / "전체" 토글로 표시 범위 전환
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Check } from 'lucide-react';
import { Modal, Input, Button } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { ComCodeBadge } from '@/components/ui';
import api from '@/services/api';
import type { JobOrderSelectItem } from '@harness/shared';

export type JobOrder = JobOrderSelectItem;

interface JobOrderSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (jobOrder: JobOrder) => void;
  filterStatus?: string[];
  equipCode?: string;
  /** 공정 조회조건 — 전달 시 해당 공정에 내려진 작업지시만 서버에서 필터링 */
  processCode?: string;
  /** 품목유형 필터 — SEMI_PRODUCT | FINISHED 등 (예: 서브공정/조립 화면) */
  itemType?: string;
}

export default function JobOrderSelectModal({
  isOpen,
  onClose,
  onConfirm,
  filterStatus = ['WAITING', 'RUNNING'],
  equipCode,
  processCode,
  itemType,
}: JobOrderSelectModalProps) {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [selectedJobOrder, setSelectedJobOrder] = useState<JobOrder | null>(null);
  const [rawData, setRawData] = useState<JobOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // filterStatus가 매 렌더 새 배열(기본값)이어도 useCallback이 재생성되지 않도록 문자열 키로 안정화.
  // (배열 참조를 deps에 직접 두면 모달 fetch→리렌더→재생성→fetch 무한 루프가 발생한다.)
  const statusesKey = filterStatus.join(',');

  const fetchJobOrders = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const res = await api.get('/production/job-orders', {
        params: {
          statuses: statusesKey,
          limit: 500,
          ...(processCode ? { processCode } : {}),
          ...(itemType ? { itemType } : {}),
        },
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
          equipCode: jo.equipCode as string | undefined,
          equipName: jo.equipName as string | undefined,
        };
      });
      // 현재 설비 배당 건 먼저 정렬
      items.sort((a, b) => {
        const aMatch = equipCode && a.equipCode === equipCode ? 0 : 1;
        const bMatch = equipCode && b.equipCode === equipCode ? 0 : 1;
        return aMatch - bMatch;
      });
      setRawData(items);
    } catch {
      setRawData([]);
    } finally {
      setLoading(false);
    }
  }, [isOpen, statusesKey, equipCode, processCode, itemType]);

  useEffect(() => {
    if (isOpen) {
      setSelectedJobOrder(null);
      setSearchText('');
      setShowAll(false);
      fetchJobOrders();
    }
  }, [isOpen, fetchJobOrders]);

  const displayData = useMemo(() => {
    const base = showAll || !equipCode
      ? rawData
      : rawData.filter(item => item.equipCode === equipCode);

    if (!searchText) return base;
    const s = searchText.toLowerCase();
    return base.filter(
      (item) =>
        item.orderNo.toLowerCase().includes(s) ||
        item.itemCode.toLowerCase().includes(s) ||
        item.itemName.toLowerCase().includes(s) ||
        (item.processCode?.toLowerCase().includes(s) ?? false),
    );
  }, [rawData, searchText, showAll, equipCode]);

  const isSelectable = (item: JobOrder) => {
    if (!equipCode) return true;
    return item.equipCode === equipCode;
  };

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
        size: 44,
        cell: ({ row }) => {
          const selectable = isSelectable(row.original);
          return (
            <button
              onClick={() => selectable && setSelectedJobOrder(row.original)}
              disabled={!selectable}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                !selectable
                  ? 'border-border bg-surface/50 cursor-not-allowed opacity-40'
                  : selectedJobOrder?.id === row.original.id
                  ? 'bg-primary border-primary'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              {selectedJobOrder?.id === row.original.id && (
                <Check className="w-4 h-4 text-white" />
              )}
            </button>
          );
        },
      },
      {
        accessorKey: 'orderNo',
        header: t('production.order.orderNo'),
        size: 150,
        cell: ({ row }) => {
          const selectable = isSelectable(row.original);
          return (
            <span className={`font-mono text-sm font-medium ${!selectable ? 'opacity-40' : ''}`}>
              {row.original.orderNo}
            </span>
          );
        },
      },
      {
        accessorKey: 'itemName',
        header: t('common.partName'),
        size: 200,
        cell: ({ row }) => {
          const selectable = isSelectable(row.original);
          return (
            <div className={!selectable ? 'opacity-40' : ''}>
              <div className="font-medium">{row.original.itemName}</div>
              <div className="text-xs text-black/60 dark:text-white/60">{row.original.itemCode}</div>
            </div>
          );
        },
      },
      {
        accessorKey: 'processType',
        header: t('production.order.process'),
        size: 90,
        cell: ({ row }) => {
          const selectable = isSelectable(row.original);
          return (
            <span className={!selectable ? 'opacity-40' : ''}>
              <ComCodeBadge groupCode="PROCESS_TYPE" code={row.original.processType ?? ''} />
            </span>
          );
        },
      },
      {
        accessorKey: 'planQty',
        header: t('production.order.planQty'),
        size: 110,
        meta: { filterType: 'number' },
        cell: ({ row }) => {
          const selectable = isSelectable(row.original);
          return (
            <div className={`text-right ${!selectable ? 'opacity-40' : ''}`}>
              <div className="font-medium">
                {row.original.completedQty.toLocaleString()} / {row.original.planQty.toLocaleString()}
              </div>
              <div className="text-xs text-black/60 dark:text-white/60">
                {row.original.planQty > 0
                  ? Math.round((row.original.completedQty / row.original.planQty) * 100)
                  : 0}%
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: t('common.status'),
        size: 90,
        cell: ({ row }) => {
          const selectable = isSelectable(row.original);
          return (
            <span className={!selectable ? 'opacity-40' : ''}>
              <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={row.original.status ?? ''} />
            </span>
          );
        },
      },
      {
        accessorKey: 'planStartDate',
        header: t('production.order.planDate'),
        size: 100,
        meta: { filterType: 'date' },
        cell: ({ row }) => {
          const selectable = isSelectable(row.original);
          return (
            <span className={`text-sm text-black/60 dark:text-white/60 ${!selectable ? 'opacity-40' : ''}`}>
              {row.original.planStartDate}
            </span>
          );
        },
      },
      ...(showAll && equipCode
        ? [{
            id: 'equipCode',
            header: t('production.order.equip', '설비'),
            size: 120,
            cell: ({ row }: { row: { original: JobOrder } }) => {
              const isCurrentEquip = row.original.equipCode === equipCode;
              return (
                <span className={`text-xs ${isCurrentEquip ? 'font-semibold text-primary' : 'text-black/60 dark:text-white/60 opacity-60'}`}>
                  {row.original.equipCode ?? '-'}
                  {isCurrentEquip && <span className="ml-1 text-[10px]">✓</span>}
                </span>
              );
            },
          }]
        : []),
    ],
    [t, selectedJobOrder, showAll, equipCode],
  );

  const currentEquipCount = useMemo(
    () => equipCode ? rawData.filter(item => item.equipCode === equipCode).length : rawData.length,
    [rawData, equipCode],
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('production.inputManual.selectJobOrder')} size="2xl">
      <div className="space-y-3">
        {/* 검색 + 필터 토글 */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Input
              placeholder={t('production.inputManual.searchJobOrderPlaceholder')}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              fullWidth
            />
          </div>
          {equipCode && (
            <div className="flex shrink-0 items-center rounded-lg border border-border bg-surface p-0.5 text-xs">
              <button
                onClick={() => setShowAll(false)}
                className={`rounded-md px-3 py-1.5 font-semibold transition-colors ${
                  !showAll ? 'bg-primary text-white shadow-sm' : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'
                }`}
              >
                {t('kiosk.jobOrder.thisEquip', '현재 설비')}
                <span className="ml-1.5 rounded-full bg-white/30 px-1.5 text-[11px]">{currentEquipCount}</span>
              </button>
              <button
                onClick={() => setShowAll(true)}
                className={`rounded-md px-3 py-1.5 font-semibold transition-colors ${
                  showAll ? 'bg-primary text-white shadow-sm' : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'
                }`}
              >
                {t('kiosk.jobOrder.allEquips', '전체')}
                <span className="ml-1.5 rounded-full bg-white/30 px-1.5 text-[11px]">{rawData.length}</span>
              </button>
            </div>
          )}
        </div>

        {showAll && equipCode && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t('kiosk.jobOrder.otherEquipNote', '다른 설비에 배당된 작업지시는 조회만 가능하며 선택할 수 없습니다.')}
          </p>
        )}

        <div className="border border-border rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-black/60 dark:text-white/60 text-sm">
              {t('common.loading', '불러오는 중...')}
            </div>
          ) : (
            <DataGrid
              data={displayData}
              columns={columns}
              pageSize={8}
              onRowClick={(row) => isSelectable(row) && setSelectedJobOrder(row)}
            />
          )}
        </div>

        {selectedJobOrder && (
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-semibold text-black dark:text-white">
                {selectedJobOrder.orderNo}
              </span>
              <span className="text-sm text-black/60 dark:text-white/60">—</span>
              <span className="text-sm text-black dark:text-white">{selectedJobOrder.itemName}</span>
              <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={selectedJobOrder.status ?? ''} />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button size="sm" variant="secondary" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={!selectedJobOrder}>
            <Check className="w-4 h-4 mr-1" />
            {t('common.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
