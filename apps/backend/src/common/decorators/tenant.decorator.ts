/**
 * @file src/common/decorators/tenant.decorator.ts
 * @description 멀티테넌시 파라미터 데코레이터 - Company/Plant 값 추출
 *
 * 초보자 가이드:
 * 1. **@Company()**: req.user.company를 컨트롤러 파라미터로 바로 주입
 * 2. **@Plant()**: req.user.plant를 컨트롤러 파라미터로 바로 주입
 * 3. **사용법**: @Get() findAll(@Company() company: string, @Plant() plant: string)
 * 4. **JwtAuthGuard**: X-Company, X-Plant 헤더를 req.user에 설정해줌
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest } from '../guards/jwt-auth.guard';

/**
 * req.user.company 값을 파라미터로 추출하는 데코레이터
 * @example @Company() company: string
 */
export const Company = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return req.user?.company;
  },
);

/**
 * req.user.plant 값을 파라미터로 추출하는 데코레이터
 * @example @Plant() plant: string
 */
export const Plant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return req.user?.plant;
  },
);
