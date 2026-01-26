/**
 * @file src/pages/shipping/components/StatCard.tsx
 * @description 출하관리 공통 통계 카드 컴포넌트
 */
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'yellow' | 'gray';
}

/** 색상별 스타일 매핑 */
const colorStyles = {
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
  gray: 'bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400',
};

export function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  const [bgClass, textClass] = colorStyles[color].split(' text-');

  return (
    <Card padding="sm">
      <CardContent>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${bgClass}`}>
            <Icon className={`w-5 h-5 text-${textClass}`} />
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
