/**
 * @file src/app/pda/material/receiving/components.tsx
 * @description 자재입고 페이지 전용 하위 컴포넌트 — 입고 이력 아이템
 */
import type { ReceivingHistoryItem } from "@/hooks/pda/useMatReceivingScan";

/** 입고 이력 한 행 */
export function ReceivingHistoryRow({ item }: { item: ReceivingHistoryItem }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {item.itemCode}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {item.itemName}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">
          {item.matUid}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
          {item.receivedQty}
        </p>
        <p className="text-xs text-slate-400">{item.timestamp}</p>
      </div>
    </div>
  );
}
