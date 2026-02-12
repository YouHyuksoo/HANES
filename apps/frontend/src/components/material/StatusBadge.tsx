"use client";

/**
 * @file src/pages/material/components/StatusBadge.tsx
 * @description 자재관리 공통 상태 배지 컴포넌트 - ComCodeBadge에 위임
 *
 * 초보자 가이드:
 * 1. **ArrivalStatus**: 입하 상태 (대기)
 * 2. **IqcStatus**: IQC 검사 상태 (대기, 검사중, 합격, 불합격)
 * 3. **ReceivingStatus**: 입고 상태 (입고대기=합격, 입고완료)
 * 4. **IssueStatus**: 출고 상태 (대기, 진행중, 완료)
 */
import { ComCodeBadge } from '@/components/ui';

/** 입하 상태 타입 */
export type ArrivalStatus = 'ARRIVED' | 'IQC_READY';

/** IQC 검사 상태 타입 */
export type IqcStatus = 'PENDING' | 'IQC_IN_PROGRESS' | 'PASSED' | 'FAILED';

/** 입고 상태 타입 (IQC 합격 후) */
export type ReceivingStatus = 'PASSED' | 'STOCKED';

/** 입하/IQC 상태 타입 (기존 호환) */
export type ReceiveStatus = 'PENDING' | 'IQC_IN_PROGRESS' | 'PASSED' | 'FAILED' | 'STOCKED';

/** 출고 상태 타입 (확장: 요청→승인→출고→완료) */
export type IssueStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

/** 출고요청 상태 타입 */
export type IssueRequestStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

/** 입하 상태 배지 */
export function ArrivalStatusBadge({ status }: { status: ArrivalStatus }) {
  const config: Record<ArrivalStatus, { label: string; className: string }> = {
    ARRIVED: { label: '입하완료', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
    IQC_READY: { label: 'IQC대기', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  };
  const { label, className } = config[status] || { label: status, className: 'bg-gray-100 text-gray-700' };
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${className}`}>{label}</span>;
}

/** IQC 상태 배지 */
export function IqcStatusBadge({ status }: { status: IqcStatus }) {
  return <ComCodeBadge groupCode="RECEIVE_STATUS" code={status} />;
}

/** 입고 상태 배지 */
export function ReceivingStatusBadge({ status }: { status: ReceivingStatus }) {
  const config: Record<ReceivingStatus, { label: string; className: string }> = {
    PASSED: { label: '입고대기', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
    STOCKED: { label: '입고완료', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  };
  const { label, className } = config[status] || { label: status, className: 'bg-gray-100 text-gray-700' };
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${className}`}>{label}</span>;
}

/** 입하 상태 배지 - ComCodeBadge에 위임 (기존 호환) */
export function ReceiveStatusBadge({ status }: { status: ReceiveStatus }) {
  if (status === 'STOCKED') {
    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">입고완료</span>;
  }
  return <ComCodeBadge groupCode="RECEIVE_STATUS" code={status} />;
}

/** 출고 상태 배지 - ComCodeBadge에 위임 */
export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  const manualConfig: Partial<Record<IssueStatus, { label: string; className: string }>> = {
    REQUESTED: { label: '요청', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
    APPROVED: { label: '승인', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
    REJECTED: { label: '반려', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  };
  const manual = manualConfig[status];
  if (manual) {
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${manual.className}`}>{manual.label}</span>;
  }
  return <ComCodeBadge groupCode="ISSUE_STATUS" code={status} />;
}

/** 출고요청 상태 배지 */
export function IssueRequestStatusBadge({ status }: { status: IssueRequestStatus }) {
  const config: Record<IssueRequestStatus, { label: string; className: string }> = {
    REQUESTED: { label: '대기', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
    APPROVED: { label: '승인', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
    REJECTED: { label: '반려', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
    COMPLETED: { label: '출고완료', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  };
  const { label, className } = config[status] || { label: status, className: 'bg-gray-100 text-gray-700' };
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${className}`}>{label}</span>;
}
