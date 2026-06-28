"use client";

/**
 * @file components/shared/StatusBadge.tsx
 * @description 상태/유형 코드 배지 — 표준 ComCodeBadge(DB 색상 + i18n 다국어 라벨)로 위임하는 얇은 래퍼
 *
 * 초보자 가이드:
 * 1. `<StatusBadge codeType="BOX_STATUS" value={row.status} />`
 * 2. 실제 표시는 `@/components/ui/ComCodeBadge`(groupCode/code)가 담당 — DB com_codes.attr1 색상 + i18n comCode 라벨
 * 3. value 가 없으면 "-" 표시
 * 4. codeType == ComCodeBadge 의 groupCode (예: BOX_STATUS, OQC_STATUS, PROD_RESULT_STATUS)
 */

import ComCodeBadge from "@/components/ui/ComCodeBadge";

export interface StatusBadgeProps {
  /** 공통코드 그룹(ComCodeBadge groupCode와 동일) */
  codeType: string;
  /** 상태 코드값 */
  value?: string | null;
  className?: string;
}

export default function StatusBadge({ codeType, value, className = "" }: StatusBadgeProps) {
  if (!value) return <span className="text-text-muted">-</span>;
  return <ComCodeBadge groupCode={codeType} code={value} className={className} />;
}
