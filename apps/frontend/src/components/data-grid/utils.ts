/**
 * @file src/components/data-grid/utils.ts
 * @description DataGrid 공통 유틸리티 함수 모음
 *
 * 초보자 가이드:
 * 1. **detectAlignment**: 셀 값의 타입을 분석하여 텍스트 정렬 방향 자동 결정
 *    - 숫자 → 우측(right), 날짜 → 중앙(center), 문자 → 좌측(left)
 * 2. **getAlignmentClass**: 정렬 방향에 맞는 Tailwind CSS 클래스 반환
 * 3. **getPinnedStyle**: 고정 컬럼(pinned column)에 필요한 sticky 스타일 생성
 * 4. 이 파일은 DataGrid 내부에서만 사용되는 헬퍼로, 외부 직접 사용은 불필요
 */
import React from 'react';

/** 날짜 패턴 감지 (YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD, DD-MM-YYYY 등) */
const datePatterns = [
  /^\d{4}[-/.]\d{2}[-/.]\d{2}$/,
  /^\d{4}[-/.]\d{2}[-/.]\d{2}\s+\d{2}:\d{2}(:\d{2})?$/,
  /^\d{2}[-/.]\d{2}[-/.]\d{4}$/,
  /^\d{4}년\s*\d{1,2}월\s*\d{1,2}일$/,
];

/** 값 타입 감지하여 정렬 방향 결정 */
export function detectAlignment(value: unknown): 'left' | 'center' | 'right' {
  if (value === null || value === undefined) return 'left';
  if (typeof value === 'number') return 'right';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^-?[\d,]+(\.\d+)?$/.test(trimmed) || /^-?\d+(\.\d+)?%$/.test(trimmed)) {
      return 'right';
    }
    for (const pattern of datePatterns) {
      if (pattern.test(trimmed)) return 'center';
    }
  }
  if (value instanceof Date) return 'center';
  return 'left';
}

/** 정렬 클래스 반환 */
export function getAlignmentClass(align: 'left' | 'center' | 'right'): string {
  switch (align) {
    case 'right': return 'text-right';
    case 'center': return 'text-center';
    default: return 'text-left';
  }
}

/** 고정 컬럼(pinned column)용 인라인 스타일 생성 */
export function getPinnedStyle(
  pinned: false | 'left' | 'right',
  startLeft: number,
  afterRight: number,
  isLastLeft: boolean,
  isFirstRight: boolean,
  zIndex: number,
): React.CSSProperties {
  return {
    ...(pinned === 'left' ? { position: 'sticky', left: startLeft, zIndex } : {}),
    ...(pinned === 'right' ? { position: 'sticky', right: afterRight, zIndex } : {}),
    ...(isLastLeft ? { boxShadow: '4px 0 8px -2px rgba(0,0,0,0.1)' } : {}),
    ...(isFirstRight ? { boxShadow: '-4px 0 8px -2px rgba(0,0,0,0.1)' } : {}),
  };
}
