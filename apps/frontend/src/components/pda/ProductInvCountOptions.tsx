/**
 * @file src/components/pda/ProductInvCountOptions.tsx
 * @description 제품 재고실사 옵션 패널 - 실사기준월, 창고, 기본수량 1개, 실사구분(정상/취소)
 *
 * 초보자 가이드:
 * 1. 실사기준월: 좌우 화살표로 월 이동 (기본: 현재 월, 미래 불가)
 * 2. 창고: 드롭다운으로 대상 창고 선택 (미선택 시 전체)
 * 3. 기본수량 1개: 체크 시 스캔 즉시 수량 1로 자동 실사
 * 4. 실사구분: 정상(일반 실사) / 취소(이전 실사 무효화)
 */
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useWarehouseOptions } from "@/hooks/useMasterOptions";

export type CountType = "NORMAL" | "CANCEL";

/** 현재 월을 YYYY-MM 형식으로 반환 */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** YYYY-MM 형식 월을 이전/다음 월로 이동 */
function shiftMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface ProductInvCountOptionsProps {
  countMonth: string;
  onCountMonthChange: (month: string) => void;
  warehouseCode: string;
  onWarehouseIdChange: (id: string) => void;
  defaultQty1: boolean;
  onDefaultQty1Change: (checked: boolean) => void;
  countType: CountType;
  onCountTypeChange: (type: CountType) => void;
  disabled: boolean;
}

export default function ProductInvCountOptions({
  countMonth,
  onCountMonthChange,
  warehouseCode,
  onWarehouseIdChange,
  defaultQty1,
  onDefaultQty1Change,
  countType,
  onCountTypeChange,
  disabled,
}: ProductInvCountOptionsProps) {
  const { t } = useTranslation();
  const { options: whOptions } = useWarehouseOptions();

  return (
    <div className="mx-4 mt-3 space-y-2.5">
      {/* 실사기준월 */}
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
          <CalendarDays className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />
          {t("pda.productInvCount.countMonth")}
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onCountMonthChange(shiftMonth(countMonth, -1))}
            disabled={disabled}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 active:bg-slate-100 dark:active:bg-slate-800 disabled:opacity-40"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 h-10 flex items-center justify-center rounded-xl border-2 border-primary/30 bg-primary/5 dark:bg-primary/10">
            <span className="text-base font-bold text-primary dark:text-primary-light">
              {t("pda.productInvCount.monthDisplay", {
                year: countMonth.split("-")[0],
                month: countMonth.split("-")[1],
              })}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onCountMonthChange(shiftMonth(countMonth, 1))}
            disabled={disabled || countMonth >= getCurrentMonth()}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 active:bg-slate-100 dark:active:bg-slate-800 disabled:opacity-40"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 창고 선택 */}
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
          {t("pda.productInvCount.warehouse")}
        </label>
        <select
          value={warehouseCode}
          onChange={(e) => onWarehouseIdChange(e.target.value)}
          disabled={disabled}
          className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-slate-900 dark:text-white disabled:opacity-40"
        >
          <option value="">{t("pda.productInvCount.allWarehouse")}</option>
          {whOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* 기본수량 1개 + 실사구분 */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            checked={defaultQty1}
            onChange={(e) => onDefaultQty1Change(e.target.checked)}
            disabled={disabled}
            className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 text-primary focus:ring-primary accent-primary"
          />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t("pda.productInvCount.defaultQty1")}
          </span>
        </label>

        <div className="flex gap-1 ml-auto">
          {(["NORMAL", "CANCEL"] as CountType[]).map((type) => {
            const isActive = countType === type;
            const isNormal = type === "NORMAL";
            const activeClass = isNormal
              ? "bg-emerald-500 text-white border-emerald-500"
              : "bg-red-500 text-white border-red-500";
            const inactiveClass =
              "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400";
            return (
              <button
                key={type}
                type="button"
                onClick={() => onCountTypeChange(type)}
                disabled={disabled}
                className={`px-3.5 h-8 rounded-lg text-xs font-bold border-2 transition-all ${isActive ? activeClass : inactiveClass} disabled:opacity-40`}
              >
                {t(
                  `pda.productInvCount.countType${isNormal ? "Normal" : "Cancel"}`,
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
