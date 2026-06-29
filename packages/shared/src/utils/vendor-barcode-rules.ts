/**
 * @file packages/shared/src/utils/vendor-barcode-rules.ts
 * @description 거래처 바코드 매핑 매칭유형 enum (프론트/백엔드 단일 출처)
 */

/** 바코드 매칭 유형 값 집합 (정확일치 / 접두사 / 정규식) */
export const VENDOR_BARCODE_MATCH_TYPES = ['EXACT', 'PREFIX', 'REGEX'] as const;

export type VendorBarcodeMatchType = (typeof VENDOR_BARCODE_MATCH_TYPES)[number];

/** 기본 매칭 유형 */
export const VENDOR_BARCODE_DEFAULT_MATCH_TYPE: VendorBarcodeMatchType = 'EXACT';
