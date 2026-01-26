/**
 * @file src/pages/equipment/components/EquipmentStatusBadge.tsx
 * @description 설비 상태 배지 컴포넌트
 */
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export type EquipStatus = 'NORMAL' | 'MAINT' | 'STOP';

export const statusConfig: Record<EquipStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  NORMAL: { label: '정상', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', icon: CheckCircle },
  MAINT: { label: '점검', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', icon: AlertTriangle },
  STOP: { label: '정지', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', icon: XCircle },
};

interface EquipmentStatusBadgeProps {
  status: EquipStatus;
}

export function EquipmentStatusBadge({ status }: EquipmentStatusBadgeProps) {
  const { label, color, icon: Icon } = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${color}`}>
      <Icon className="w-3 h-3" />{label}
    </span>
  );
}

export default EquipmentStatusBadge;
