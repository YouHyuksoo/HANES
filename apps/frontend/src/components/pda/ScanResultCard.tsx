"use client";

/**
 * @file src/components/pda/ScanResultCard.tsx
 * @description 바코드 스캔 결과 카드 - 키-값 쌍 표시
 *
 * 초보자 가이드:
 * 1. **fields**: 표시할 키-값 쌍 배열
 * 2. **variant**: success/error/info에 따른 색상 변화
 * 3. 스캔 후 결과를 깔끔하게 보여주는 카드 컴포넌트
 */
import { CheckCircle, AlertTriangle, Info } from "lucide-react";

export interface ScanResultField {
  /** 라벨 (i18n 적용된 문자열) */
  label: string;
  /** 값 */
  value: string | number;
  /** 강조 표시 */
  highlight?: boolean;
}

interface ScanResultCardProps {
  /** 표시할 필드 목록 */
  fields: ScanResultField[];
  /** 카드 상태 */
  variant?: "success" | "error" | "info";
  /** 타이틀 (선택) */
  title?: string;
  /** 에러 메시지 */
  errorMessage?: string;
}

const variantConfig = {
  success: {
    border: "border-emerald-200 dark:border-emerald-800",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    icon: CheckCircle,
    iconColor: "text-emerald-500",
  },
  error: {
    border: "border-red-200 dark:border-red-800",
    bg: "bg-red-50 dark:bg-red-950/30",
    icon: AlertTriangle,
    iconColor: "text-red-500",
  },
  info: {
    border: "border-blue-200 dark:border-blue-800",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    icon: Info,
    iconColor: "text-blue-500",
  },
};

export default function ScanResultCard({
  fields,
  variant = "info",
  title,
  errorMessage,
}: ScanResultCardProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  if (errorMessage) {
    const errConfig = variantConfig.error;
    const ErrIcon = errConfig.icon;
    return (
      <div
        className={`mx-4 p-4 rounded-xl border ${errConfig.border} ${errConfig.bg}`}
      >
        <div className="flex items-center gap-2 mb-1">
          <ErrIcon className={`w-5 h-5 ${errConfig.iconColor}`} />
          <span className="text-sm font-medium text-red-700 dark:text-red-300">
            {errorMessage}
          </span>
        </div>
      </div>
    );
  }

  if (fields.length === 0) return null;

  return (
    <div className={`mx-4 p-4 rounded-xl border ${config.border} ${config.bg}`}>
      {title && (
        <div className="flex items-center gap-2 mb-3">
          <Icon className={`w-5 h-5 ${config.iconColor}`} />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {title}
          </span>
        </div>
      )}

      <div className="space-y-2">
        {fields.map((field, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between py-1.5 border-b border-slate-200/50 dark:border-slate-700/50 last:border-0"
          >
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {field.label}
            </span>
            <span
              className={`text-sm font-medium ${
                field.highlight
                  ? "text-primary font-bold"
                  : "text-slate-800 dark:text-slate-200"
              }`}
            >
              {field.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
