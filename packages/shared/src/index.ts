/**
 * @file packages/shared/src/index.ts
 * @description HARNESS MES 공유 패키지 진입점
 *
 * 초보자 가이드:
 * 1. **전체 import**: import { JobOrder, MENU_ITEMS, formatDate } from '@harness/shared'
 * 2. **부분 import**: import type { JobOrder } from '@harness/shared/types'
 * 3. **상수만**: import { MENU_ITEMS } from '@harness/shared/constants'
 * 4. **유틸만**: import { formatDate } from '@harness/shared/utils'
 */

// 타입 내보내기
export * from './types';

// 상수 내보내기
export * from './constants';

// 유틸리티 내보내기
export * from './utils';
