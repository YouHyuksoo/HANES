"use client";

/**
 * @file safetyAlertColumns.tsx
 * @description 소모품 안전재고 사전알림 컬럼 정의
 *
 * 수량 계산식이 화면에 드러나야 담당자가 판정을 납득한다.
 * 가용 − 교체임박 = 실효가용 을 나란히 두고, 실효가용을 안전재고와 비교한다.
 */
import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import type { ConsumableSafetyLevel } from '@harness/shared';
import type { ConsumableSafetyRow } from '@/hooks/consumables/useConsumableSafetyAlert';

/** 파스텔 배경 대신 텍스트·테두리로 수준을 구분한다 */
const LEVEL_STYLE: Record<ConsumableSafetyLevel, string> = {
  SHORTAGE: 'text-danger border-danger',
  PRE_ALERT: 'text-warning border-warning',
  NORMAL: 'text-success border-success',
  NOT_MANAGED: 'text-text-muted border-border',
};

export function buildSafetyAlertColumns(t: TFunction): ColumnDef<ConsumableSafetyRow>[] {
  const levelLabel: Record<ConsumableSafetyLevel, string> = {
    SHORTAGE: t('consumables.safetyAlert.levelShortage', '부족'),
    PRE_ALERT: t('consumables.safetyAlert.levelPreAlert', '사전경고'),
    NORMAL: t('consumables.safetyAlert.levelNormal', '정상'),
    NOT_MANAGED: t('consumables.safetyAlert.levelNotManaged', '미설정'),
  };

  return [
    {
      accessorKey: 'level',
      header: t('consumables.safetyAlert.level', '수준'),
      size: 90,
      meta: { align: 'center' as const },
      cell: ({ getValue }) => {
        const level = getValue() as ConsumableSafetyLevel;
        return (
          <span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-semibold ${LEVEL_STYLE[level]}`}>
            {levelLabel[level]}
          </span>
        );
      },
    },
    {
      accessorKey: 'consumableCode',
      header: t('consumables.comp.consumableCode', '소모품코드'),
      size: 150,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span>,
    },
    {
      accessorKey: 'name',
      header: t('consumables.comp.consumableName', '소모품명'),
      size: 200,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'availableQty',
      header: t('consumables.safetyAlert.availableQty', '가용재고'),
      size: 90,
      meta: { align: 'right' as const },
      cell: ({ row }) => (
        <span className="tabular-nums text-xs">
          {row.original.availableQty.toLocaleString()}
          {row.original.wornOutQty > 0 ? (
            <span className="ml-1 text-[10px] text-text-muted">
              ({t('consumables.safetyAlert.wornOut', '수명소진')} {row.original.wornOutQty})
            </span>
          ) : null}
        </span>
      ),
    },
    {
      accessorKey: 'replacingQty',
      header: t('consumables.safetyAlert.replacingQty', '교체임박'),
      size: 90,
      meta: { align: 'right' as const },
      cell: ({ getValue }) => {
        const n = getValue() as number;
        return <span className={`tabular-nums text-xs ${n > 0 ? 'text-warning font-semibold' : 'text-text-muted'}`}>{n.toLocaleString()}</span>;
      },
    },
    {
      accessorKey: 'effectiveQty',
      header: t('consumables.safetyAlert.effectiveQty', '실효가용'),
      size: 90,
      meta: { align: 'right' as const },
      cell: ({ getValue }) => {
        const n = getValue() as number;
        return <span className={`tabular-nums text-xs font-semibold ${n <= 0 ? 'text-danger' : 'text-text'}`}>{n.toLocaleString()}</span>;
      },
    },
    {
      accessorKey: 'safetyStock',
      header: t('consumables.master.safetyStock', '안전재고'),
      size: 90,
      meta: { align: 'right' as const },
      cell: ({ getValue }) => <span className="tabular-nums text-xs">{(getValue() as number).toLocaleString()}</span>,
    },
    {
      accessorKey: 'preAlertThreshold',
      header: t('consumables.safetyAlert.threshold', '사전경고 임계'),
      size: 110,
      meta: { align: 'right' as const },
      cell: ({ getValue }) => <span className="tabular-nums text-xs text-text-muted">{(getValue() as number).toLocaleString()}</span>,
    },
    {
      accessorKey: 'shortageQty',
      header: t('consumables.safetyAlert.shortageQty', '부족수량'),
      size: 90,
      meta: { align: 'right' as const },
      cell: ({ getValue }) => {
        const n = getValue() as number;
        return n > 0
          ? <span className="tabular-nums text-xs font-semibold text-danger">{n.toLocaleString()}</span>
          : <span className="text-xs text-text-muted">-</span>;
      },
    },
    {
      accessorKey: 'location',
      header: t('consumables.master.location', '보관위치'),
      size: 120,
      cell: ({ getValue }) => <span className="text-xs">{(getValue() as string | null) ?? '-'}</span>,
    },
    {
      accessorKey: 'vendor',
      header: t('consumables.master.vendor', '공급처'),
      size: 140,
      cell: ({ getValue }) => <span className="text-xs">{(getValue() as string | null) ?? '-'}</span>,
    },
  ];
}
