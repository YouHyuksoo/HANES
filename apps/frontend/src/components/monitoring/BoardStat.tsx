"use client";

/**
 * @file src/components/monitoring/BoardStat.tsx
 * @description 보드 KPI 스탯 카드 — TV 가독성 기준 큰 숫자, 파스텔 배경 금지(텍스트/테두리 구분)
 */
import type { ReactNode } from "react";

interface BoardStatProps {
  label: string;
  value: ReactNode;
  /** 값 아래 보조 텍스트 */
  sub?: ReactNode;
  /** 값 색상 클래스 (기본 text-text) */
  valueClassName?: string;
  icon?: ReactNode;
}

export default function BoardStat({ label, value, sub, valueClassName = "text-text", icon }: BoardStatProps) {
  return (
    <div className="flex-1 min-w-0 rounded-xl border border-border bg-surface px-4 py-3 flex flex-col justify-center">
      <div className="flex items-center gap-1.5 text-xs font-medium text-text-muted truncate">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-1 text-3xl font-bold tabular-nums leading-tight truncate ${valueClassName}`}>
        {value}
      </div>
      {sub !== undefined && <div className="mt-0.5 text-xs text-text-muted truncate">{sub}</div>}
    </div>
  );
}
