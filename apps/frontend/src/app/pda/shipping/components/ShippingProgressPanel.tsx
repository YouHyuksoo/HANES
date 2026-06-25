/**
 * @file src/app/(pda)/shipping/components/ShippingProgressPanel.tsx
 * @description 출하 진행률 패널 — 스캔 수량/프로그레스바/박스 목록 표시
 *
 * 초보자 가이드:
 * - scannedItems 배열을 받아 박스 목록과 진행률을 렌더링
 * - fromPallet 필드가 있으면 팔레트 출처 표시
 */
import { useTranslation } from "react-i18next";
import { Package, XCircle } from "lucide-react";
import type { ScannedShipItem } from "@/hooks/pda/useShippingScan";

interface ShippingProgressPanelProps {
  scannedQty: number;
  orderQty: number;
  progressPct: number;
  scannedItems: ScannedShipItem[];
  onCancelBox?: (boxNo: string) => void;
  disabled?: boolean;
}

/**
 * 출하 진행률 및 스캔 박스 목록 패널
 */
export function ShippingProgressPanel({
  scannedQty,
  orderQty,
  progressPct,
  scannedItems,
  onCancelBox,
  disabled = false,
}: ShippingProgressPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="mx-4 mt-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      {/* 수량 표시 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {t("pda.shipping.progress")}
        </span>
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
          {t("pda.shipping.scannedQty")}: {scannedQty} / {orderQty}
        </span>
      </div>

      {/* 프로그레스 바 */}
      <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            progressPct >= 100 ? "bg-emerald-500" : "bg-primary"
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* 스캔된 박스 목록 */}
      {scannedItems.length > 0 && (
        <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
          {scannedItems.map((item, idx) => (
            <div
              key={`${item.boxNo}-${idx}`}
              className="flex items-center justify-between py-1 px-2 rounded bg-slate-50 dark:bg-slate-800"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Package className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate">
                  {item.boxNo}
                </span>
              </div>
              <div className="ml-2 flex flex-shrink-0 items-center gap-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {item.qty}
                </span>
                {onCancelBox && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onCancelBox(item.boxNo)}
                    className="rounded p-0.5 text-red-500 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-900/20"
                    aria-label={t("pda.shipping.cancelBox", "출하 취소")}
                    title={t("pda.shipping.cancelBox", "출하 취소")}
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
