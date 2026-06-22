/**
 * @file src/components/ui/Badge.tsx
 * @description 의미별(variant) 상태 배지. 하드코딩된 인라인 span 배지/색상맵을 대체한다.
 *
 * 공통코드 기반 상태는 ComCodeBadge를 우선 사용하고,
 * 코드값이 아닌 임의 상태(잔여수량/유형 등)에 이 Badge를 사용한다.
 * 스타일은 ComCodeBadge(채움 pill)와 일관된다.
 *
 * 사용 예:
 *   <Badge variant="success">정상</Badge>
 *   <Badge variant="error" size="md">불량</Badge>
 */
import type { ReactNode } from 'react';

export type BadgeVariant = 'info' | 'success' | 'warning' | 'error' | 'neutral';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  children: ReactNode;
}

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  success: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  error: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

const SIZE_CLASS: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export default function Badge({ variant = 'neutral', size = 'sm', className = '', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
    >
      {children}
    </span>
  );
}
