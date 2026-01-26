/**
 * @file packages/shared/src/constants/process.ts
 * @description 공정 관련 상수 정의
 *
 * 초보자 가이드:
 * 1. **PROCESS_CODES**: 공정 코드와 이름 매핑
 * 2. **PROCESS_ORDER**: 공정 순서 정의
 * 3. **PROCESS_CONFIG**: 공정별 설정값
 */

import type { SupportedLanguage } from './index';

/** 공정 정보 타입 */
export interface ProcessInfo {
  code: string;
  name: {
    ko: string;
    en: string;
    vi: string;
  };
  shortCode: string;
  order: number;
  color: string;
}

/** 공정 정보 */
export const PROCESSES: Record<string, ProcessInfo> = {
  CUTTING: {
    code: 'CUTTING',
    name: { ko: '절단', en: 'Cutting', vi: 'Cắt' },
    shortCode: 'CUT',
    order: 10,
    color: 'bg-orange-500',
  },
  CRIMPING: {
    code: 'CRIMPING',
    name: { ko: '압착', en: 'Crimping', vi: 'Ép' },
    shortCode: 'CRM',
    order: 20,
    color: 'bg-blue-500',
  },
  ASSEMBLY: {
    code: 'ASSEMBLY',
    name: { ko: '조립', en: 'Assembly', vi: 'Lắp ráp' },
    shortCode: 'ASM',
    order: 30,
    color: 'bg-green-500',
  },
  INSPECTION: {
    code: 'INSPECTION',
    name: { ko: '검사', en: 'Inspection', vi: 'Kiểm tra' },
    shortCode: 'INS',
    order: 40,
    color: 'bg-purple-500',
  },
  PACKING: {
    code: 'PACKING',
    name: { ko: '포장', en: 'Packing', vi: 'Đóng gói' },
    shortCode: 'PKG',
    order: 50,
    color: 'bg-teal-500',
  },
} as const;

/** 공정 코드 목록 (순서대로) */
export const PROCESS_ORDER = [
  'CUTTING',
  'CRIMPING',
  'ASSEMBLY',
  'INSPECTION',
  'PACKING',
] as const;

/** 공정 Short 코드 매핑 */
export const PROCESS_SHORT_CODES: Record<string, string> = {
  CUTTING: 'CUT',
  CRIMPING: 'CRM',
  ASSEMBLY: 'ASM',
  INSPECTION: 'INS',
  PACKING: 'PKG',
} as const;

/** 공정별 기본 설정 */
export const PROCESS_CONFIG: Record<string, {
  hasApplicator: boolean;      // 어플리케이터 사용 여부
  hasBlade: boolean;           // 날 사용 여부
  requiresMaterialInput: boolean;  // 자재 투입 필요 여부
  supportsRework: boolean;     // 재작업 지원 여부
  defaultCycleTime: number;    // 기본 사이클타임 (초)
}> = {
  CUTTING: {
    hasApplicator: false,
    hasBlade: true,
    requiresMaterialInput: true,
    supportsRework: false,
    defaultCycleTime: 3,
  },
  CRIMPING: {
    hasApplicator: true,
    hasBlade: false,
    requiresMaterialInput: true,
    supportsRework: true,
    defaultCycleTime: 5,
  },
  ASSEMBLY: {
    hasApplicator: false,
    hasBlade: false,
    requiresMaterialInput: true,
    supportsRework: true,
    defaultCycleTime: 10,
  },
  INSPECTION: {
    hasApplicator: false,
    hasBlade: false,
    requiresMaterialInput: false,
    supportsRework: false,
    defaultCycleTime: 8,
  },
  PACKING: {
    hasApplicator: false,
    hasBlade: false,
    requiresMaterialInput: true,  // 포장재
    supportsRework: false,
    defaultCycleTime: 15,
  },
} as const;

/** 불량코드 그룹 (공정별) */
export const DEFECT_CODE_GROUPS: Record<string, {
  code: string;
  name: { ko: string; en: string; vi: string };
}[]> = {
  CUTTING: [
    { code: 'CUT001', name: { ko: '길이불량', en: 'Length defect', vi: 'Lỗi chiều dài' } },
    { code: 'CUT002', name: { ko: '스트립불량', en: 'Strip defect', vi: 'Lỗi tước' } },
    { code: 'CUT003', name: { ko: '찍힘', en: 'Dent', vi: 'Lõm' } },
    { code: 'CUT004', name: { ko: '코어손상', en: 'Core damage', vi: 'Hư lõi' } },
  ],
  CRIMPING: [
    { code: 'CRM001', name: { ko: '압착높이불량', en: 'Crimp height defect', vi: 'Lỗi chiều cao ép' } },
    { code: 'CRM002', name: { ko: '압착폭불량', en: 'Crimp width defect', vi: 'Lỗi chiều rộng ép' } },
    { code: 'CRM003', name: { ko: '인장력불량', en: 'Pull force defect', vi: 'Lỗi lực kéo' } },
    { code: 'CRM004', name: { ko: '윈도우불량', en: 'Window defect', vi: 'Lỗi cửa sổ' } },
    { code: 'CRM005', name: { ko: '벨마우스불량', en: 'Bell mouth defect', vi: 'Lỗi miệng chuông' } },
  ],
  ASSEMBLY: [
    { code: 'ASM001', name: { ko: '조립불량', en: 'Assembly defect', vi: 'Lỗi lắp ráp' } },
    { code: 'ASM002', name: { ko: '락킹불량', en: 'Locking defect', vi: 'Lỗi khóa' } },
    { code: 'ASM003', name: { ko: '하우징손상', en: 'Housing damage', vi: 'Hư vỏ' } },
    { code: 'ASM004', name: { ko: '터미널누락', en: 'Terminal missing', vi: 'Thiếu đầu nối' } },
  ],
  INSPECTION: [
    { code: 'INS001', name: { ko: '단선', en: 'Open', vi: 'Hở mạch' } },
    { code: 'INS002', name: { ko: '단락', en: 'Short', vi: 'Ngắn mạch' } },
    { code: 'INS003', name: { ko: '오결선', en: 'Miswire', vi: 'Nối sai' } },
    { code: 'INS004', name: { ko: '저항불량', en: 'Resistance defect', vi: 'Lỗi điện trở' } },
  ],
  PACKING: [
    { code: 'PKG001', name: { ko: '포장불량', en: 'Packing defect', vi: 'Lỗi đóng gói' } },
    { code: 'PKG002', name: { ko: '수량부족', en: 'Quantity shortage', vi: 'Thiếu số lượng' } },
    { code: 'PKG003', name: { ko: '라벨불량', en: 'Label defect', vi: 'Lỗi nhãn' } },
  ],
} as const;

/**
 * 공정 코드로 공정 이름 반환
 * @param code 공정 코드
 * @param lang 언어
 * @returns 공정 이름
 */
export function getProcessName(code: string, lang: SupportedLanguage = 'ko'): string {
  return PROCESSES[code]?.name[lang] ?? code;
}

/**
 * 공정 코드로 Short 코드 반환
 * @param code 공정 코드
 * @returns Short 코드
 */
export function getProcessShortCode(code: string): string {
  return PROCESS_SHORT_CODES[code] ?? code.substring(0, 3).toUpperCase();
}

/**
 * Short 코드로 공정 코드 반환
 * @param shortCode Short 코드
 * @returns 공정 코드
 */
export function getProcessCodeByShort(shortCode: string): string | undefined {
  const entry = Object.entries(PROCESS_SHORT_CODES).find(([, short]) => short === shortCode);
  return entry?.[0];
}
