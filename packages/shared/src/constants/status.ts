/**
 * @file packages/shared/src/constants/status.ts
 * @description 상태 코드 상수 및 라벨 정의
 *
 * 초보자 가이드:
 * 1. **STATUS_LABELS**: UI에 표시할 상태 라벨 (다국어 지원)
 * 2. **STATUS_COLORS**: 상태별 색상 (Tailwind CSS 클래스)
 * 3. **getStatusLabel()**: 상태 코드를 라벨로 변환
 */

import type { SupportedLanguage } from './index';

/** 상태 라벨 타입 */
export interface StatusLabel {
  ko: string;
  en: string;
  vi: string;
}

/** 작업 상태 라벨 */
export const WORK_STATUS_LABELS: Record<string, StatusLabel> = {
  PENDING: { ko: '대기', en: 'Pending', vi: 'Chờ xử lý' },
  IN_PROGRESS: { ko: '진행중', en: 'In Progress', vi: 'Đang tiến hành' },
  COMPLETED: { ko: '완료', en: 'Completed', vi: 'Hoàn thành' },
  CANCELED: { ko: '취소', en: 'Canceled', vi: 'Đã hủy' },
  ON_HOLD: { ko: '보류', en: 'On Hold', vi: 'Tạm dừng' },
} as const;

/** 작업 상태 색상 */
export const WORK_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  CANCELED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  ON_HOLD: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
} as const;

/** 품질 판정 라벨 */
export const QUALITY_JUDGMENT_LABELS: Record<string, StatusLabel> = {
  PASS: { ko: '합격', en: 'Pass', vi: 'Đạt' },
  FAIL: { ko: '불합격', en: 'Fail', vi: 'Không đạt' },
  PENDING: { ko: '판정대기', en: 'Pending', vi: 'Chờ phán định' },
  CONDITIONAL: { ko: '조건부합격', en: 'Conditional', vi: 'Đạt có điều kiện' },
} as const;

/** 품질 판정 색상 */
export const QUALITY_JUDGMENT_COLORS: Record<string, string> = {
  PASS: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  FAIL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  PENDING: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  CONDITIONAL: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
} as const;

/** IQC 상태 라벨 */
export const IQC_STATUS_LABELS: Record<string, StatusLabel> = {
  WAITING: { ko: '검사대기', en: 'Waiting', vi: 'Chờ kiểm tra' },
  IN_PROGRESS: { ko: '검사중', en: 'In Progress', vi: 'Đang kiểm tra' },
  PASSED: { ko: '합격', en: 'Passed', vi: 'Đạt' },
  FAILED: { ko: '불합격', en: 'Failed', vi: 'Không đạt' },
  HOLD: { ko: '보류', en: 'Hold', vi: 'Tạm giữ' },
} as const;

/** IQC 상태 색상 */
export const IQC_STATUS_COLORS: Record<string, string> = {
  WAITING: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  PASSED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  HOLD: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
} as const;

/** 설비 상태 라벨 */
export const EQUIPMENT_STATUS_LABELS: Record<string, StatusLabel> = {
  RUNNING: { ko: '가동중', en: 'Running', vi: 'Đang chạy' },
  IDLE: { ko: '대기', en: 'Idle', vi: 'Chờ' },
  MAINTENANCE: { ko: '보전중', en: 'Maintenance', vi: 'Bảo trì' },
  BREAKDOWN: { ko: '고장', en: 'Breakdown', vi: 'Hỏng' },
  SETUP: { ko: '셋업중', en: 'Setup', vi: 'Cài đặt' },
} as const;

/** 설비 상태 색상 */
export const EQUIPMENT_STATUS_COLORS: Record<string, string> = {
  RUNNING: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  IDLE: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  MAINTENANCE: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  BREAKDOWN: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  SETUP: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
} as const;

/** 출하 상태 라벨 */
export const SHIPMENT_STATUS_LABELS: Record<string, StatusLabel> = {
  PLANNED: { ko: '계획', en: 'Planned', vi: 'Kế hoạch' },
  PICKING: { ko: '피킹중', en: 'Picking', vi: 'Đang lấy hàng' },
  PACKED: { ko: '포장완료', en: 'Packed', vi: 'Đã đóng gói' },
  SHIPPED: { ko: '출하완료', en: 'Shipped', vi: 'Đã xuất hàng' },
  DELIVERED: { ko: '배송완료', en: 'Delivered', vi: 'Đã giao hàng' },
  CANCELED: { ko: '취소', en: 'Canceled', vi: 'Đã hủy' },
} as const;

/** 출하 상태 색상 */
export const SHIPMENT_STATUS_COLORS: Record<string, string> = {
  PLANNED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  PICKING: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  PACKED: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  SHIPPED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  DELIVERED: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300',
  CANCELED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
} as const;

/** 불량 처리 라벨 */
export const DEFECT_DISPOSITION_LABELS: Record<string, StatusLabel> = {
  REPAIR: { ko: '수리', en: 'Repair', vi: 'Sửa chữa' },
  REWORK: { ko: '재작업', en: 'Rework', vi: 'Làm lại' },
  SCRAP: { ko: '폐기', en: 'Scrap', vi: 'Phế liệu' },
  CONCESSION: { ko: '특채', en: 'Concession', vi: 'Chấp nhận đặc biệt' },
} as const;

/** 불량 처리 색상 */
export const DEFECT_DISPOSITION_COLORS: Record<string, string> = {
  REPAIR: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  REWORK: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  SCRAP: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  CONCESSION: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
} as const;

/** 인터페이스 상태 라벨 */
export const INTERFACE_STATUS_LABELS: Record<string, StatusLabel> = {
  PENDING: { ko: '전송대기', en: 'Pending', vi: 'Chờ gửi' },
  SENT: { ko: '전송완료', en: 'Sent', vi: 'Đã gửi' },
  FAILED: { ko: '전송실패', en: 'Failed', vi: 'Gửi thất bại' },
  CONFIRMED: { ko: '확인완료', en: 'Confirmed', vi: 'Đã xác nhận' },
} as const;

/** 인터페이스 상태 색상 */
export const INTERFACE_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  SENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  CONFIRMED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
} as const;

/**
 * 상태 코드를 라벨로 변환
 * @param statusLabels 상태 라벨 객체
 * @param code 상태 코드
 * @param lang 언어 코드
 * @returns 해당 언어의 라벨
 */
export function getStatusLabel(
  statusLabels: Record<string, StatusLabel>,
  code: string,
  lang: SupportedLanguage = 'ko'
): string {
  return statusLabels[code]?.[lang] ?? code;
}

/**
 * 상태 코드에 해당하는 색상 클래스 반환
 * @param statusColors 상태 색상 객체
 * @param code 상태 코드
 * @returns Tailwind CSS 클래스
 */
export function getStatusColor(
  statusColors: Record<string, string>,
  code: string
): string {
  return statusColors[code] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
}
