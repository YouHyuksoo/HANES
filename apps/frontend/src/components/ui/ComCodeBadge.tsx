/**
 * @file src/components/ui/ComCodeBadge.tsx
 * @description DB 기반 공통코드 상태 배지 컴포넌트
 *
 * 초보자 가이드:
 * 1. **사용법**: <ComCodeBadge groupCode="JOB_ORDER_STATUS" code="RUNNING" />
 * 2. **색상/라벨**: DB com_codes 테이블에서 자동 로드
 * 3. **fallback**: API 미응답 시 code 값을 그대로 표시
 */

import React from 'react';
import { useComCodeItem } from '@/hooks/useComCode';
import type { ComCodeItem } from '@/hooks/useComCode';

export interface ComCodeBadgeProps {
  /** 공통코드 그룹 (예: 'JOB_ORDER_STATUS') */
  groupCode: string;
  /** 상세 코드 값 (예: 'RUNNING') */
  code: string;
  /** 추가 CSS 클래스 */
  className?: string;
  /** 아이콘 컴포넌트 (선택) */
  icon?: React.ComponentType<{ className?: string }>;
}

const DEFAULT_COLOR = 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';

/**
 * 공통코드 기반 상태 배지
 * groupCode + code로 DB에서 라벨/색상을 자동 조회하여 렌더링
 */
export default function ComCodeBadge({ groupCode, code, className = '', icon: Icon }: ComCodeBadgeProps) {
  const item = useComCodeItem(groupCode, code);

  const label = item?.codeName ?? code;
  const color = item?.attr1 ?? DEFAULT_COLOR;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color} ${className}`}>
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </span>
  );
}

/**
 * 공통코드 배지 - code 항목을 직접 전달하는 버전 (목록 렌더링 최적화용)
 */
export function ComCodeBadgeDirect({ item, code, className = '', icon: Icon }: {
  item: ComCodeItem | null;
  code: string;
  className?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const label = item?.codeName ?? code;
  const color = item?.attr1 ?? DEFAULT_COLOR;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color} ${className}`}>
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </span>
  );
}
