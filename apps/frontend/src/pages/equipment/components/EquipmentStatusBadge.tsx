/**
 * @file src/pages/equipment/components/EquipmentStatusBadge.tsx
 * @description 설비 상태 배지 컴포넌트 - ComCodeBadge에 위임
 */
import ComCodeBadge from '@/components/ui/ComCodeBadge';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export type EquipStatus = 'NORMAL' | 'MAINT' | 'STOP';

// Keep statusConfig exported since EquipStatusPage uses it directly for the status modal
export const statusConfig: Record<EquipStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  NORMAL: { label: '정상', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', icon: CheckCircle },
  MAINT: { label: '점검', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', icon: AlertTriangle },
  STOP: { label: '정지', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', icon: XCircle },
};

export function EquipmentStatusBadge({ status }: { status: EquipStatus }) {
  const iconMap: Record<EquipStatus, typeof CheckCircle> = { NORMAL: CheckCircle, MAINT: AlertTriangle, STOP: XCircle };
  return <ComCodeBadge groupCode="EQUIP_STATUS" code={status} icon={iconMap[status]} />;
}

export default EquipmentStatusBadge;
