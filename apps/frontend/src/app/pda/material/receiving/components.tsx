/**
 * @file src/app/pda/material/receiving/components.tsx
 * @description 자재입고 페이지 전용 하위 컴포넌트 — IQC 배지 + 이력 아이템
 *
 * 초보자 가이드:
 * - IQC_BADGE_MAP: IQC 상태별 색상·i18n 키 매핑 상수
 * - IqcBadge: IQC 상태 배지 컴포넌트
 * - ReceivingHistoryRow: 입고 이력 한 행 렌더
 */
import { useTranslation } from "react-i18next";
import type { IqcStatus, ReceivingHistoryItem } from "@/hooks/pda/useMatReceivingScan";

/** IQC 상태별 배지 색상 및 i18n 라벨 키 */
export const IQC_BADGE_MAP: Record<
  IqcStatus,
  { className: string; labelKey: string }
> = {
  PASS: {
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    labelKey: "pda.receiving.iqcPass",
  },
  FAIL: {
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    labelKey: "pda.receiving.iqcFail",
  },
  IN_PROGRESS: {
    className:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
    labelKey: "pda.receiving.iqcInProgress",
  },
  NONE: {
    className:
      "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
    labelKey: "pda.receiving.iqcNone",
  },
};

/** IQC 상태 배지 */
export function IqcBadge({ status }: { status: IqcStatus }) {
  const { t } = useTranslation();
  const badge = IQC_BADGE_MAP[status] ?? IQC_BADGE_MAP.NONE;
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${badge.className}`}
    >
      IQC: {t(badge.labelKey)}
    </span>
  );
}

/** 입고 이력 한 행 */
export function ReceivingHistoryRow({ item }: { item: ReceivingHistoryItem }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {item.itemCode}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {item.itemName}
        </p>
        {item.locationCode && (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {t("pda.receiving.location")}: {item.locationCode}
          </p>
        )}
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
