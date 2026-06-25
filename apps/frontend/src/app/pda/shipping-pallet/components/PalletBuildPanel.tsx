"use client";

/**
 * @file src/app/pda/shipping-pallet/components/PalletBuildPanel.tsx
 * @description 팔레트 구성 패널 — 현재 팔레트/적재 박스 목록/수량 표시 + 박스 제거
 */
import { useTranslation } from "react-i18next";
import { Boxes, Package, X } from "lucide-react";
import type { CurrentPallet } from "@/hooks/pda/usePalletShipScan.types";

export function PalletBuildPanel({
  pallet,
  onRemoveBox,
  disabled,
}: {
  pallet: CurrentPallet;
  onRemoveBox: (boxNo: string) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const isOpen = pallet.status === "OPEN";
  return (
    <div className="mx-4 mt-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Boxes className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">{pallet.palletNo}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {pallet.status}
          </span>
        </div>
        <div className="text-right text-xs text-slate-500 dark:text-slate-400">
          <span className="mr-2">{t("pda.palletShip.boxCount", "박스")} {pallet.boxCount}</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{pallet.totalQty.toLocaleString()}</span>
        </div>
      </div>

      <div className="mt-3 space-y-2 max-h-[40vh] overflow-y-auto">
        {pallet.boxes.length === 0 ? (
          <div className="py-6 text-center text-slate-400 dark:text-slate-500">
            <Package className="mx-auto mb-2 h-10 w-10 opacity-50" />
            <p className="text-sm">{t("pda.palletShip.noBoxes", "박스를 스캔해 적재하세요.")}</p>
          </div>
        ) : (
          pallet.boxes.map((box) => (
            <div key={box.boxNo} className="flex items-center justify-between rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <div>
                <p className="font-mono text-sm text-slate-800 dark:text-slate-200">{box.boxNo}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{box.itemCode}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{box.qty.toLocaleString()}</span>
                {isOpen && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onRemoveBox(box.boxNo)}
                    className="rounded p-1 hover:bg-slate-200 disabled:opacity-40 dark:hover:bg-slate-700"
                    aria-label={t("pda.palletShip.removeBox", "박스 제거")}
                  >
                    <X className="h-4 w-4 text-red-500" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
