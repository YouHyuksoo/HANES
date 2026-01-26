/**
 * @file src/pages/shipping/components/StatusBadge.tsx
 * @description 출하관리 공통 상태 배지 컴포넌트
 */

/** 박스 상태 타입 */
export type BoxStatus = 'OPEN' | 'CLOSED' | 'SHIPPED';

/** 팔레트 상태 타입 */
export type PalletStatus = 'OPEN' | 'CLOSED' | 'LOADED' | 'SHIPPED';

/** 출하 상태 타입 */
export type ShipmentStatus = 'PREPARING' | 'LOADED' | 'SHIPPED' | 'DELIVERED';

/** 박스 상태 배지 */
export function BoxStatusBadge({ status }: { status: BoxStatus }) {
  const config = {
    OPEN: { label: '진행중', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
    CLOSED: { label: '포장완료', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
    SHIPPED: { label: '출하', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  };
  const { label, className } = config[status];
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${className}`}>{label}</span>;
}

/** 팔레트 상태 배지 */
export function PalletStatusBadge({ status }: { status: PalletStatus }) {
  const config = {
    OPEN: { label: '진행중', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
    CLOSED: { label: '적재완료', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
    LOADED: { label: '차량적재', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
    SHIPPED: { label: '출하', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  };
  const { label, className } = config[status];
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${className}`}>{label}</span>;
}

/** 출하 상태 배지 */
export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  const config = {
    PREPARING: { label: '준비중', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
    LOADED: { label: '적재완료', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
    SHIPPED: { label: '출하완료', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
    DELIVERED: { label: '배송완료', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  };
  const { label, className } = config[status];
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${className}`}>{label}</span>;
}
