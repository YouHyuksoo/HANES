"use client";

/**
 * @file src/components/ui/StatCard.tsx
 * @description 공통 통계 카드 컴포넌트 - 페이지 상단 요약 정보 표시용
 *
 * 초보자 가이드:
 * 1. **label**: 카드 제목 (예: "총 재고", "합격률")
 * 2. **value**: 표시할 값 (숫자는 자동 포맷)
 * 3. **icon**: lucide-react 아이콘
 * 4. **color**: 테마 색상 (blue, green, red 등)
 */
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from './Card';

export interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'red' | 'orange' | 'yellow' | 'gray' | 'purple';
}

/** 색상별 아이콘 배경/텍스트 스타일 */
const COLOR_STYLES: Record<StatCardProps['color'], { bg: string; text: string }> = {
  blue:   { bg: 'bg-blue-100 dark:bg-blue-900/30',     text: 'text-blue-600 dark:text-blue-400' },
  green:  { bg: 'bg-green-100 dark:bg-green-900/30',    text: 'text-green-600 dark:text-green-400' },
  red:    { bg: 'bg-red-100 dark:bg-red-900/30',        text: 'text-red-600 dark:text-red-400' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-900/30',   text: 'text-orange-600 dark:text-orange-400' },
  yellow: { bg: 'bg-yellow-100 dark:bg-yellow-900/30',   text: 'text-yellow-600 dark:text-yellow-400' },
  gray:   { bg: 'bg-gray-100 dark:bg-gray-900/30',      text: 'text-gray-600 dark:text-gray-400' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-900/30',   text: 'text-purple-600 dark:text-purple-400' },
};

export function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  const { bg, text } = COLOR_STYLES[color];

  return (
    <Card padding="sm">
      <CardContent>
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-md ${bg}`}>
            <Icon className={`w-4 h-4 ${text}`} />
          </div>
          <div>
            <p className="text-xs text-text-muted">{label}</p>
            <p className="text-lg font-bold leading-tight text-text">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default StatCard;
