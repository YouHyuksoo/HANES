"use client";

/**
 * @file src/components/monitoring/BoardStat.tsx
 * @description 전광판형 스탯 — 박스 없이 소형 대문자 라벨 + 초대형 tabular 숫자.
 *              부모가 `flex divide-x divide-border` 스트립으로 감싸 괘선으로만 구획한다.
 *              (카드박스 그리드 금지 — 전광판 타이포 위계로 정보 전달)
 */
import type { ReactNode } from "react";

interface BoardStatProps {
  label: string;
  value: ReactNode;
  /** 값 아래 보조 텍스트 */
  sub?: ReactNode;
  /** 값 색상 클래스 (기본 text-text) */
  valueClassName?: string;
}

export default function BoardStat({ label, value, sub, valueClassName = "text-text" }: BoardStatProps) {
  return (
    <div className="flex-1 min-w-0 px-5 first:pl-1 last:pr-1">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted truncate">
        {label}
      </div>
      <div className={`mt-1.5 text-4xl 2xl:text-5xl font-extrabold tabular-nums leading-none tracking-tight truncate ${valueClassName}`}>
        {value}
      </div>
      {sub !== undefined && <div className="mt-1.5 text-xs text-text-muted truncate">{sub}</div>}
    </div>
  );
}

/** 전광판 섹션 제목 — 소형 대문자 + 우측으로 뻗는 괘선 */
export function BoardSectionTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted whitespace-nowrap">
        {children}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
