"use client";

/**
 * @file src/pages/equipment/components/PartStatusBadge.tsx
 * @description 소모품 상태 배지 컴포넌트
 */
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export type PartStatus = 'OK' | 'WARNING' | 'REPLACE';

export const partStatusConfig: Record<PartStatus, { label: string; color: string; bgColor: string; icon: typeof CheckCircle }> = {
  OK: { label: '정상', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', bgColor: '', icon: CheckCircle },
  WARNING: { label: '경고', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20', icon: AlertTriangle },
  REPLACE: { label: '교체필요', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', bgColor: 'bg-red-50 dark:bg-red-900/20', icon: XCircle },
};

interface PartStatusBadgeProps {
  status: PartStatus;
}

export function PartStatusBadge({ status }: PartStatusBadgeProps) {
  const { label, color, icon: Icon } = partStatusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${color}`}>
      <Icon className="w-3 h-3" />{label}
    </span>
  );
}

export default PartStatusBadge;
