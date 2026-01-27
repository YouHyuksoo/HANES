/**
 * @file packages/shared/src/constants/index.ts
 * @description 공통 상수 정의
 *
 * 초보자 가이드:
 * 1. **사용법**: import { MENU_ITEMS, PROCESS_CODES } from '@hanes/shared/constants'
 * 2. **as const**: 타입 추론을 위해 readonly로 정의됨
 */

/** API 엔드포인트 기본 경로 */
export const API_BASE_PATH = '/api/v1';

/** 페이지네이션 기본값 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/** 날짜 포맷 */
export const DATE_FORMAT = {
  DATE: 'YYYY-MM-DD',
  DATETIME: 'YYYY-MM-DD HH:mm:ss',
  TIME: 'HH:mm:ss',
  DISPLAY_DATE: 'YYYY년 MM월 DD일',
  DISPLAY_DATETIME: 'YYYY년 MM월 DD일 HH:mm',
  COMPACT_DATE: 'YYYYMMDD',
  COMPACT_DATETIME: 'YYYYMMDDHHmmss',
} as const;

/** 공정 코드 */
export const PROCESS_CODES = {
  CUTTING: 'CUT',
  CRIMPING: 'CRM',
  ASSEMBLY: 'ASM',
  INSPECTION: 'INS',
  PACKING: 'PKG',
} as const;

/** 창고 코드 */
export const WAREHOUSE_CODES = {
  RAW_MATERIAL: 'WH-RM',
  SEMI_PRODUCT: 'WH-SP',
  FINISHED_GOODS: 'WH-FG',
  MRB: 'WH-MRB',           // 불량 격리 창고
  HOLD: 'WH-HOLD',         // 보류 창고
  LINE: 'WH-LINE',         // 라인 재고
} as const;

/** QR 코드 접두사 */
export const QR_PREFIX = {
  BOX: 'BOX',
  PALLET: 'PLT',
  LOT: 'LOT',
  SERIAL: 'SER',
} as const;

/** 권한 코드 */
export const PERMISSION_CODES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  OPERATOR: 'OPERATOR',
  VIEWER: 'VIEWER',
} as const;

/** 다국어 지원 언어 */
export const SUPPORTED_LANGUAGES = ['ko', 'en', 'vi'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

/** 교대(Shift) 코드 */
export const SHIFT_CODES = {
  DAY: { code: 'DAY', name: { ko: '주간', en: 'Day', vi: 'Ca ngày' }, startHour: 6, endHour: 14 },
  SWING: { code: 'SWING', name: { ko: '중간', en: 'Swing', vi: 'Ca chiều' }, startHour: 14, endHour: 22 },
  NIGHT: { code: 'NIGHT', name: { ko: '야간', en: 'Night', vi: 'Ca đêm' }, startHour: 22, endHour: 6 },
} as const;

/** 단위 코드 */
export const UNIT_CODES = {
  EA: { code: 'EA', name: { ko: '개', en: 'EA', vi: 'Cái' } },
  M: { code: 'M', name: { ko: '미터', en: 'Meter', vi: 'Mét' } },
  KG: { code: 'KG', name: { ko: '킬로그램', en: 'Kilogram', vi: 'Kg' } },
  ROLL: { code: 'ROLL', name: { ko: '롤', en: 'Roll', vi: 'Cuộn' } },
  SET: { code: 'SET', name: { ko: '세트', en: 'Set', vi: 'Bộ' } },
  BOX: { code: 'BOX', name: { ko: '박스', en: 'Box', vi: 'Hộp' } },
} as const;

/** 통화 코드 */
export const CURRENCY_CODES = {
  KRW: { code: 'KRW', symbol: '₩', name: '원' },
  USD: { code: 'USD', symbol: '$', name: 'Dollar' },
  VND: { code: 'VND', symbol: '₫', name: 'Đồng' },
} as const;

// 메뉴 상수
export * from './menu';

// 상태 코드 상수
export * from './status';

// 공정 상수
export * from './process';

// 공통코드 값 상수
export * from './com-code-values';
