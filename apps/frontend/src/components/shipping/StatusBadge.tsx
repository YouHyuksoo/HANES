"use client";

/**
 * @file src/pages/shipping/components/StatusBadge.tsx
 * @description 출하관리 공통 상태 배지 컴포넌트 (ComCodeBadge 위임)
 *
 * 초보자 가이드:
 * 1. **하위 호환**: 기존 컴포넌트 인터페이스를 유지하면서 ComCodeBadge로 위임
 * 2. **그룹 코드**: BOX_STATUS, PALLET_STATUS, SHIPMENT_STATUS
 */
import { ComCodeBadge } from '@/components/ui';

/** 박스 상태 타입 */
export type BoxStatus = 'OPEN' | 'CLOSED' | 'SHIPPED';

/** 팔레트 상태 타입 */
export type PalletStatus = 'OPEN' | 'CLOSED' | 'LOADED' | 'SHIPPED';

/** 출하 상태 타입 */
export type ShipmentStatus = 'PREPARING' | 'LOADED' | 'SHIPPED' | 'DELIVERED';

/** 박스 상태 배지 - ComCodeBadge 위임 */
export function BoxStatusBadge({ status }: { status: BoxStatus }) {
  return <ComCodeBadge groupCode="BOX_STATUS" code={status} />;
}

/** 팔레트 상태 배지 - ComCodeBadge 위임 */
export function PalletStatusBadge({ status }: { status: PalletStatus }) {
  return <ComCodeBadge groupCode="PALLET_STATUS" code={status} />;
}

/** 출하 상태 배지 - ComCodeBadge 위임 */
export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  return <ComCodeBadge groupCode="SHIPMENT_STATUS" code={status} />;
}
