/**
 * @file src/pages/material/components/StatusBadge.tsx
 * @description 자재관리 공통 상태 배지 컴포넌트
 *
 * 초보자 가이드:
 * 1. **ReceiveStatus**: 입하 상태 (대기, IQC진행, 합격, 불합격)
 * 2. **IssueStatus**: 출고 상태 (대기, 진행중, 완료)
 */

/** 입하/IQC 상태 타입 */
export type ReceiveStatus = 'PENDING' | 'IQC_IN_PROGRESS' | 'PASSED' | 'FAILED';

/** 출고 상태 타입 */
export type IssueStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

/** 입하 상태 배지 */
export function ReceiveStatusBadge({ status }: { status: ReceiveStatus }) {
  const config = {
    PENDING: { label: '입하대기', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
    IQC_IN_PROGRESS: { label: 'IQC진행', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
    PASSED: { label: '합격', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
    FAILED: { label: '불합격', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  };
  const { label, className } = config[status];
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${className}`}>{label}</span>;
}

/** 출고 상태 배지 */
export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  const config = {
    PENDING: { label: '대기', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
    IN_PROGRESS: { label: '진행중', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
    COMPLETED: { label: '완료', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  };
  const { label, className } = config[status];
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${className}`}>{label}</span>;
}
