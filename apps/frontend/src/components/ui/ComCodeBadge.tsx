"use client";

/**
 * @file src/components/ui/ComCodeBadge.tsx
 * @description DB 기반 공통코드 상태 배지 컴포넌트 (다국어 지원)
 *
 * 초보자 가이드:
 * 1. **사용법**: <ComCodeBadge groupCode="JOB_ORDER_STATUS" code="RUNNING" />
 * 2. **색상**: DB com_codes 테이블의 attr1에서 Tailwind 색상 클래스 로드
 * 3. **라벨**: i18n 번역 파일에서 현재 언어에 맞는 라벨 표시 (fallback: DB codeName)
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
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
 * 공통코드 기반 상태 배지 (다국어 지원)
 * groupCode + code로 DB에서 색상 조회, i18n에서 현재 언어 라벨 표시
 */
export default function ComCodeBadge({ groupCode, code, className = '', icon: Icon }: ComCodeBadgeProps) {
  const { t } = useTranslation();
  const item = useComCodeItem(groupCode, code);

  const translated = t(`comCode.${groupCode}.${code}`, { defaultValue: '' });
  const label = translated || item?.codeName || code;
  const color = item?.attr1 ?? DEFAULT_COLOR;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color} ${className}`}>
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </span>
  );
}

/**
 * 공통코드 배지 - code 항목을 직접 전달하는 버전 (목록 렌더링 최적화용, 다국어 지원)
 */
export function ComCodeBadgeDirect({ item, code, groupCode, className = '', icon: Icon }: {
  item: ComCodeItem | null;
  code: string;
  groupCode: string;
  className?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const { t } = useTranslation();
  const translated = t(`comCode.${groupCode}.${code}`, { defaultValue: '' });
  const label = translated || item?.codeName || code;
  const color = item?.attr1 ?? DEFAULT_COLOR;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color} ${className}`}>
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </span>
  );
}
