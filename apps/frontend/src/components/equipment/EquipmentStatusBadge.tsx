"use client";

/**
 * @file src/pages/equipment/components/EquipmentStatusBadge.tsx
 * @description 설비 상태 배지 컴포넌트 - ComCodeBadge에 위임 (다국어 지원)
 */
import ComCodeBadge from '@/components/ui/ComCodeBadge';
import { useComCodeLabel, useComCodeColor } from '@/hooks/useComCode';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export type EquipStatus = 'NORMAL' | 'MAINT' | 'STOP';

const iconMap: Record<EquipStatus, typeof CheckCircle> = {
  NORMAL: CheckCircle,
  MAINT: AlertTriangle,
  STOP: XCircle,
};

/**
 * 설비 상태 배지 - ComCodeBadge 위임 (다국어 자동 지원)
 */
export function EquipmentStatusBadge({ status }: { status: EquipStatus }) {
  return <ComCodeBadge groupCode="EQUIP_STATUS" code={status} icon={iconMap[status]} />;
}

/**
 * 설비 상태 config를 훅으로 조회하는 헬퍼 (모달 등에서 사용)
 */
export function useEquipStatusConfig(status: EquipStatus) {
  const label = useComCodeLabel('EQUIP_STATUS', status);
  const color = useComCodeColor('EQUIP_STATUS', status);
  return { label, color, icon: iconMap[status] };
}

export default EquipmentStatusBadge;
