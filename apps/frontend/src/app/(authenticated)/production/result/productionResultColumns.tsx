"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { Button, ComCodeBadge } from "@/components/ui";
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
  workDate: string;
  startAt: string;
  endAt: string;
  workHours: number;
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
    { accessorKey: 'resultNo', header: t('production.result.resultNo'), size: 150, meta: { filterType: 'text' as const } },
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
    {
      id: 'actions', header: t('common.actions'), size: 120,
      meta: { filterType: 'none' as const },
      cell: ({ row }) => {
        return (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => onEditResult(row.original)}>
              {t('common.edit')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDeleteResult(row.original)}
              className="text-red-600 dark:text-red-400">
              {t('common.delete')}
            </Button>
          </div>
        );
      },
    },
  ];
}
