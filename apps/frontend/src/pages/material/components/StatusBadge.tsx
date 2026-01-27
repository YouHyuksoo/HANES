/**
 * @file src/pages/material/components/StatusBadge.tsx
 * @description 자재관리 공통 상태 배지 컴포넌트 - ComCodeBadge에 위임
 *
 * 초보자 가이드:
 * 1. **ReceiveStatus**: 입하 상태 (대기, IQC진행, 합격, 불합격)
 * 2. **IssueStatus**: 출고 상태 (대기, 진행중, 완료)
 * 3. **ComCodeBadge**: 중앙 공통코드 시스템의 배지 컴포넌트에 위임
 */
import { ComCodeBadge } from '@/components/ui';

/** 입하/IQC 상태 타입 */
export type ReceiveStatus = 'PENDING' | 'IQC_IN_PROGRESS' | 'PASSED' | 'FAILED';

/** 출고 상태 타입 */
export type IssueStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

/** 입하 상태 배지 - ComCodeBadge에 위임 */
export function ReceiveStatusBadge({ status }: { status: ReceiveStatus }) {
  return <ComCodeBadge groupCode="RECEIVE_STATUS" code={status} />;
}

/** 출고 상태 배지 - ComCodeBadge에 위임 */
export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  return <ComCodeBadge groupCode="ISSUE_STATUS" code={status} />;
}
