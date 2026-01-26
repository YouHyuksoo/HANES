/**
 * @file packages/shared/src/types/index.ts
 * @description 공유 타입 정의 모음
 *
 * 초보자 가이드:
 * 1. **사용법**: import { JobOrder, MatLot } from '@hanes/shared/types'
 * 2. **구조**: 도메인별로 파일 분리 (master, production, material 등)
 */

// API 관련 타입
export * from './api';

// Enum 타입
export * from './enums';

// 추적성 타입
export * from './traceability';

// 기준정보 타입
export * from './master';

// 생산 관련 타입
export * from './production';

// 자재/재고 관련 타입
export * from './material';

// 품질 관련 타입
export * from './quality';

// 출하 관련 타입
export * from './shipping';
