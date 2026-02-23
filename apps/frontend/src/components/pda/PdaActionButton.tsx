"use client";

/**
 * @file src/components/pda/PdaActionButton.tsx
 * @description PDA 하단 고정 액션 버튼 - 확인/다음 스캔 등
 *
 * 초보자 가이드:
 * 1. 화면 하단에 고정되는 버튼 영역 (sticky bottom)
 * 2. primary: 메인 액션, secondary: 보조 액션
 * 3. safe-area-inset 대응 (노치/홈바)
 */
import { Loader2 } from "lucide-react";

interface ActionButton {
  /** 버튼 텍스트 */
  label: string;
  /** 클릭 핸들러 */
  onClick: () => void;
  /** 버튼 스타일 */
  variant?: "primary" | "secondary" | "danger";
  /** 비활성화 */
  disabled?: boolean;
  /** 로딩 */
  isLoading?: boolean;
  /** 아이콘 */
  icon?: React.ReactNode;
}

interface PdaActionButtonProps {
  /** 버튼 목록 (최대 2개 권장) */
  buttons: ActionButton[];
}

const variantStyles = {
  primary:
    "bg-primary text-white shadow-lg shadow-primary/25 hover:bg-primary-hover active:opacity-90",
  secondary:
    "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100",
  danger:
    "bg-red-500 text-white shadow-lg shadow-red-500/25 hover:bg-red-600 active:opacity-90",
};

export default function PdaActionButton({ buttons }: PdaActionButtonProps) {
  if (buttons.length === 0) return null;

  return (
    <div className="sticky bottom-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-t border-slate-200 dark:border-slate-700 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className={`flex gap-3 ${buttons.length === 1 ? "" : "grid grid-cols-2"}`}>
        {buttons.map((btn, idx) => (
          <button
            key={idx}
            type="button"
            onClick={btn.onClick}
            disabled={btn.disabled || btn.isLoading}
            className={`flex items-center justify-center gap-2 h-12 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              variantStyles[btn.variant || "primary"]
            } ${buttons.length === 1 ? "w-full" : ""}`}
          >
            {btn.isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              btn.icon
            )}
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
