"use client";

/**
 * @file src/pages/equipment/components/LifeProgressBar.tsx
 * @description 소모품 수명 진행바 컴포넌트
 */

interface LifeProgressBarProps {
  current: number;
  expected: number;
}

export function LifeProgressBar({ current, expected }: LifeProgressBarProps) {
  const percent = Math.min(Math.round((current / expected) * 100), 100);
  const barColor = percent >= 90 ? 'bg-red-500' : percent >= 70 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs text-text-muted w-10 text-right">{percent}%</span>
    </div>
  );
}

export default LifeProgressBar;
