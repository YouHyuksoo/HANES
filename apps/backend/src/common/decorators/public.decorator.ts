/**
 * @file src/common/decorators/public.decorator.ts
 * @description 인증 예외 데코레이터 - APP_GUARD(JwtAuthGuard) 전역 인증을 건너뛴다.
 *
 * 초보자 가이드:
 * 1. @Public()을 붙인 핸들러/컨트롤러는 토큰 없이 접근 가능
 * 2. 로그인/회원가입/공개 목록(로그인 페이지용)/헬스체크 등에 사용
 * 3. JwtAuthGuard가 Reflector로 IS_PUBLIC_KEY 메타데이터를 확인해 통과시킨다
 */
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
