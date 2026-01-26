/**
 * @file src/pages/material/components/StatCard.tsx
 * @description 자재관리 공통 통계 카드 컴포넌트
 */
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'red' | 'orange' | 'yellow' | 'gray' | 'purple';
}

/** 색상별 스타일 매핑 */
const colorStyles: Record<StatCardProps['color'], string> = {
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
  gray: 'bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400',
  purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
};

export function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  const styles = colorStyles[color];

  return (
    <Card padding="sm">
      <CardContent>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${styles.split(' ')[0]} ${styles.split(' ')[1]}`}>
            <Icon className={`w-5 h-5 ${styles.split(' ')[2]} ${styles.split(' ')[3]}`} />
          </div>
          <div>
            <p className="text-sm text-text-muted">{label}</p>
            <p className="text-xl font-bold text-text">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default StatCard;
