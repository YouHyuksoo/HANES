/**
 * @file src/common/index.ts
 * @description Common 모듈 배럴 파일 (re-export)
 *
 * 초보자 가이드:
 * 1. **목적**: common 폴더의 모든 export를 한 곳에서 관리
 * 2. **사용법**: import { ... } from '@common' 또는 './common'
 */

// DTOs
export * from './dto/response.dto';
export * from './dto/base-query.dto';

// Filters
export * from './filters/http-exception.filter';

// Decorators
export * from './decorators/tenant.decorator';

// Guards
export * from './guards/jwt-auth.guard';

// Interceptors
export * from './interceptors/logging.interceptor';
export * from './interceptors/transform.interceptor';
