/**
 * @file packages/shared/src/utils/numbering.ts
 * @description 체번(번호 생성) 유틸리티 함수
 *
 * 초보자 가이드:
 * 1. **LOT 번호**: 자재 입고 시 부여되는 추적 번호
 * 2. **박스 번호**: 포장 완료된 박스의 QR 코드
 * 3. **팔레트 번호**: 적재 팔레트의 QR 코드
 *
 * 번호 체계:
 * - LOT: LOT + YYYYMMDD + 라인코드 + 일련번호 (예: LOT20240115L01001)
 * - BOX: BOX + YYYYMMDD + 라인코드 + 일련번호 (예: BOX20240115L01001)
 * - PLT: PLT + YYYYMMDD + 일련번호 (예: PLT20240115001)
 */

import { getDatePrefix, getDateTimePrefix } from './date';

/** 번호 생성 옵션 */
export interface NumberingOptions {
  prefix?: string;
  date?: Date;
  lineCode?: string;
  sequence?: number;
  sequenceLength?: number;
}

/**
 * LOT 번호 생성
 * @param options 생성 옵션
 * @returns LOT 번호 (예: LOT20240115L01001)
 *
 * @example
 * generateLotNumber({ lineCode: 'L01', sequence: 1 })
 * // 'LOT20240115L01001'
 */
export function generateLotNumber(options: NumberingOptions = {}): string {
  const {
    prefix = 'LOT',
    date = new Date(),
    lineCode = '',
    sequence = 1,
    sequenceLength = 3,
  } = options;

  const dateStr = getDatePrefix(date);
  const seqStr = String(sequence).padStart(sequenceLength, '0');

  return `${prefix}${dateStr}${lineCode}${seqStr}`;
}

/**
 * 박스 번호 생성
 * @param options 생성 옵션
 * @returns 박스 번호 (예: BOX20240115L01001)
 *
 * @example
 * generateBoxNumber({ lineCode: 'L01', sequence: 1 })
 * // 'BOX20240115L01001'
 */
export function generateBoxNumber(options: NumberingOptions = {}): string {
  return generateLotNumber({
    prefix: 'BOX',
    ...options,
  });
}

/**
 * 팔레트 번호 생성
 * @param options 생성 옵션
 * @returns 팔레트 번호 (예: PLT20240115001)
 *
 * @example
 * generatePalletNumber({ sequence: 1 })
 * // 'PLT20240115001'
 */
export function generatePalletNumber(options: NumberingOptions = {}): string {
  return generateLotNumber({
    prefix: 'PLT',
    lineCode: '', // 팔레트는 라인 코드 없음
    ...options,
  });
}

/**
 * 시리얼 번호 생성
 * @param options 생성 옵션
 * @returns 시리얼 번호 (예: SER20240115093045001)
 *
 * @example
 * generateSerialNumber({ sequence: 1 })
 * // 'SER20240115093045001'
 */
export function generateSerialNumber(options: NumberingOptions = {}): string {
  const {
    prefix = 'SER',
    date = new Date(),
    sequence = 1,
    sequenceLength = 3,
  } = options;

  const dateTimeStr = getDateTimePrefix(date);
  const seqStr = String(sequence).padStart(sequenceLength, '0');

  return `${prefix}${dateTimeStr}${seqStr}`;
}

/**
 * 작업지시 번호 생성
 * @param options 생성 옵션
 * @returns 작업지시 번호 (예: WO20240115001)
 *
 * @example
 * generateJobOrderNumber({ sequence: 1 })
 * // 'WO20240115001'
 */
export function generateJobOrderNumber(options: NumberingOptions = {}): string {
  return generateLotNumber({
    prefix: 'WO',
    lineCode: '',
    ...options,
  });
}

/**
 * 출하 번호 생성
 * @param options 생성 옵션
 * @returns 출하 번호 (예: SHP20240115001)
 */
export function generateShipmentNumber(options: NumberingOptions = {}): string {
  return generateLotNumber({
    prefix: 'SHP',
    lineCode: '',
    ...options,
  });
}

/**
 * 검사 번호 생성
 * @param inspType 검사 유형 (IQC, PQC, FQC, OQC)
 * @param options 생성 옵션
 * @returns 검사 번호 (예: IQC20240115001)
 */
export function generateInspectionNumber(
  inspType: 'IQC' | 'PQC' | 'FQC' | 'OQC',
  options: NumberingOptions = {}
): string {
  return generateLotNumber({
    prefix: inspType,
    lineCode: '',
    ...options,
  });
}

/**
 * 불량 번호 생성
 * @param processCode 공정 코드 (CUT, CRM, ASM 등)
 * @param options 생성 옵션
 * @returns 불량 번호 (예: DEF-CUT-20240115-001)
 */
export function generateDefectNumber(
  processCode: string,
  options: NumberingOptions = {}
): string {
  const {
    date = new Date(),
    sequence = 1,
    sequenceLength = 3,
  } = options;

  const dateStr = getDatePrefix(date);
  const seqStr = String(sequence).padStart(sequenceLength, '0');

  return `DEF-${processCode}-${dateStr}-${seqStr}`;
}

/**
 * 수리 번호 생성
 * @param options 생성 옵션
 * @returns 수리 번호 (예: RPR20240115001)
 */
export function generateRepairNumber(options: NumberingOptions = {}): string {
  return generateLotNumber({
    prefix: 'RPR',
    lineCode: '',
    ...options,
  });
}

/**
 * 재고 조정 번호 생성
 * @param options 생성 옵션
 * @returns 조정 번호 (예: ADJ20240115001)
 */
export function generateAdjustmentNumber(options: NumberingOptions = {}): string {
  return generateLotNumber({
    prefix: 'ADJ',
    lineCode: '',
    ...options,
  });
}

/**
 * 이동 번호 생성
 * @param options 생성 옵션
 * @returns 이동 번호 (예: TRF20240115001)
 */
export function generateTransferNumber(options: NumberingOptions = {}): string {
  return generateLotNumber({
    prefix: 'TRF',
    lineCode: '',
    ...options,
  });
}

/**
 * 번호에서 날짜 추출
 * @param number 생성된 번호
 * @returns 날짜 문자열 (YYYYMMDD) 또는 null
 *
 * @example
 * extractDateFromNumber('LOT20240115L01001') // '20240115'
 */
export function extractDateFromNumber(number: string): string | null {
  // 8자리 숫자 패턴 (YYYYMMDD)
  const match = number.match(/\d{8}/);
  return match ? match[0] : null;
}

/**
 * 번호에서 일련번호 추출
 * @param number 생성된 번호
 * @returns 일련번호 또는 null
 *
 * @example
 * extractSequenceFromNumber('LOT20240115L01001') // 1
 */
export function extractSequenceFromNumber(number: string): number | null {
  // 맨 뒤의 숫자들
  const match = number.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * 번호 유효성 검사
 * @param number 검사할 번호
 * @param prefix 예상 접두사
 * @returns 유효하면 true
 */
export function isValidNumber(number: string, prefix: string): boolean {
  if (!number || !number.startsWith(prefix)) return false;

  // 날짜 부분 검사
  const dateStr = extractDateFromNumber(number);
  if (!dateStr) return false;

  // 날짜 유효성 검사
  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10);
  const day = parseInt(dateStr.substring(6, 8), 10);

  if (year < 2020 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  return true;
}
