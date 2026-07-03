"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Trash2 } from "lucide-react";
import { ComCodeBadge } from "@/components/ui";
import StatusBadge from "@/components/shared/StatusBadge";
import { WorkerAvatar } from "@/components/worker/WorkerSelector";
import { getWorkerDisplayName } from "@/components/worker/workerAvatar";

/** 생산실적 인터페이스 */
export interface ProdResult {
  id: string;
  resultNo: string;
  orderNo: string;
  processType: string;
  itemCode: string;
  itemName: string;
  lineName: string;
  processName: string;
  equipName: string;
  workerName?: string | null;
  workerDept?: string | null;
  workerId?: string | null;
  worker?: { workerName?: string | null; dept?: string | null };
  prdUid: string;
  goodQty: number;
  defectQty: number;
  totalQty: number;
  status: string;
  productionType: 'TRIAL' | 'MASS' | string;
  workDate: string;
  startAt: string;
  endAt: string;
  workHours: number;
  /** 이 실적으로 발행된 FG가 이미 포장/출하까지 진행됐는지 — true면 수정/삭제가 서버에서 차단된다 */
  hasDownstreamProgress?: boolean;
}

const getDefectRate = (result: ProdResult): string => {
  if (result.totalQty === 0) return '0.0';
  return ((result.defectQty / result.totalQty) * 100).toFixed(1);
};

interface CreateProductionResultGridColumnsOptions {
  t: TFunction;
  onEditResult: (row: ProdResult) => void;
  onDeleteResult: (row: ProdResult) => void;
}

export function createProductionResultGridColumns({
  t,
  onEditResult,
  onDeleteResult,
}: CreateProductionResultGridColumnsOptions): ColumnDef<ProdResult>[] {
  return [
    {
      id: 'actions', header: t('common.actions'), size: 80,
      meta: { align: 'center' as const, filterType: 'none' as const },
      cell: ({ row }) => {
        // 이미 취소됐거나(재취소/재삭제 불가) FG가 포장·출하까지 진행된 실적은 되돌리기가
        // 서버에서 막히므로(ensureNoDownstreamProgress), 그리드에서도 아이콘을 미리 비활성화한다.
        const locked = row.original.status === 'CANCELED' || !!row.original.hasDownstreamProgress;
        const lockedTitle = row.original.status === 'CANCELED'
          ? t('production.result.alreadyCanceled', '이미 취소된 실적입니다.')
          : t('production.result.downstreamLocked', '이미 포장/출하까지 진행되어 수정·삭제할 수 없습니다.');
        return (
          <div className="flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); if (!locked) onEditResult(row.original); }}
              disabled={locked}
              className="p-1 hover:bg-surface rounded disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              title={locked ? lockedTitle : t('common.edit')}
              aria-label={t('common.edit')}
            >
              <Edit2 className="w-4 h-4 text-primary" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); if (!locked) onDeleteResult(row.original); }}
              disabled={locked}
              className="p-1 hover:bg-surface rounded disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              title={locked ? lockedTitle : t('common.delete')}
              aria-label={t('common.delete')}
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        );
      },
    },
    { accessorKey: 'resultNo', header: t('production.result.resultNo'), size: 150, meta: { filterType: 'text' as const } },
    {
      accessorKey: 'status', header: t('production.result.status', '상태'), size: 90,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => <StatusBadge codeType="PROD_RESULT_STATUS" value={getValue() as string} />
    },
    {
      accessorKey: 'productionType', header: t('production.result.productionType', '생산유형'), size: 90,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => {
        const value = getValue() as string;
        const label = value === 'MASS' ? '양산' : '시생산';
        const cls = value === 'MASS'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
          : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800';
        return <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
      },
    },
    { accessorKey: 'workDate', header: t('production.result.workDate'), size: 100, meta: { filterType: 'date' as const } },
    {
      accessorKey: 'processType', header: t('production.order.processType'), size: 80,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="PROCESS_TYPE" code={getValue() as string} />
    },
    { accessorKey: 'orderNo', header: t('production.result.orderNo'), size: 150, meta: { filterType: 'text' as const } },
    { accessorKey: 'itemName', header: t('production.result.partName'), size: 130, meta: { filterType: 'text' as const } },
    { accessorKey: 'lineName', header: t('production.progress.line'), size: 90, meta: { filterType: 'text' as const }, cell: ({ getValue }) => (getValue() as string) || "-" },
    { accessorKey: 'equipName', header: t('production.result.equipment'), size: 90, meta: { filterType: 'text' as const } },
    {
      accessorKey: 'workerName', header: t('production.result.worker'), size: 110,
      meta: { filterType: 'text' as const },
      cell: ({ row }) => {
        const workerName = row.original.workerName ?? row.original.worker?.workerName ?? row.original.workerId;
        const workerDept = row.original.workerDept ?? row.original.worker?.dept;
        return (
          <div className="flex items-center gap-2">
            <WorkerAvatar name={workerName} dept={workerDept} size="sm" />
            <span className="text-sm">{getWorkerDisplayName(workerName)}</span>
          </div>
        );
      }
    },
    { accessorKey: 'prdUid', header: t('production.result.prdUid'), size: 150, meta: { filterType: 'text' as const } },
    {
      accessorKey: 'goodQty', header: t('production.result.goodQty'), size: 70,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => <span className="text-green-600 dark:text-green-400 font-medium">{((getValue() as number) ?? 0).toLocaleString()}</span>
    },
    {
      accessorKey: 'defectQty', header: t('production.result.defectQty'), size: 70,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => <span className="text-red-600 dark:text-red-400 font-medium">{((getValue() as number) ?? 0).toLocaleString()}</span>
    },
    {
      id: 'defectRate', header: t('production.result.defectRate'), size: 80,
      meta: { filterType: 'none' as const },
      cell: ({ row }) => {
        const rate = parseFloat(getDefectRate(row.original));
        return <span className={`${rate > 3 ? 'text-red-500' : 'text-text-muted'}`}>{rate}%</span>;
      }
    },
    {
      id: 'workTime', header: t('production.result.workTime'), size: 120,
      meta: { filterType: 'none' as const },
      cell: ({ row }) => <span className="text-text-muted">{row.original.startAt} ~ {row.original.endAt}</span>
    },
  ];
}
