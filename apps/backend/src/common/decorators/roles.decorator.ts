/**
 * @file src/common/decorators/roles.decorator.ts
 * @description 역할 기반 접근 제어 데코레이터 - 컨트롤러/메서드에 필요한 역할을 지정한다.
 *
 * 초보자 가이드:
 * 1. **@Roles('ADMIN')**: 해당 엔드포인트에 ADMIN 역할만 접근 허용
 * 2. **@Roles('ADMIN', 'MANAGER')**: 여러 역할 중 하나라도 일치하면 허용
 * 3. **RolesGuard**와 함께 사용: @UseGuards(JwtAuthGuard, RolesGuard) + @Roles(...)
 * 4. 역할 미지정 시 RolesGuard가 모든 요청을 허용 (public endpoint)
 */

import { SetMetadata } from '@nestjs/common';

/** Reflector 메타데이터 키 */
export const ROLES_KEY = 'roles';

/**
 * 엔드포인트에 필요한 역할을 지정하는 데코레이터
 * @param roles 허용할 역할 목록 (예: 'ADMIN', 'MANAGER')
 * @example @Roles('ADMIN', 'MANAGER')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
