/**
 * @file src/common/guards/roles.guard.ts
 * @description 역할 기반 접근 제어 가드 - @Roles() 데코레이터와 함께 사용하여
 *              요청 사용자의 역할을 검증한다.
 *
 * 초보자 가이드:
 * 1. **목적**: @Roles() 데코레이터로 지정된 역할과 req.user.role을 비교
 * 2. **사용법**: @UseGuards(JwtAuthGuard, RolesGuard) + @Roles('ADMIN')
 * 3. **역할 미지정**: @Roles()가 없으면 모든 인증된 사용자 허용
 * 4. **역할 불일치**: ForbiddenException 발생 (403)
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedRequest } from './jwt-auth.guard';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * 요청 사용자의 역할이 필요 역할에 포함되는지 확인
   * @param context 실행 컨텍스트
   * @returns 접근 허용 여부
   */
  canActivate(context: ExecutionContext): boolean {
    // 핸들러 또는 클래스에 지정된 역할 메타데이터 조회
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 역할이 지정되지 않았으면 모든 요청 허용
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    // 사용자 정보 또는 역할이 없으면 접근 거부
    if (!user || !user.role) {
      throw new ForbiddenException('접근 권한이 없습니다.');
    }

    // 사용자 역할이 필요 역할 목록에 포함되는지 확인
    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException(
        `이 기능은 ${requiredRoles.join(', ')} 역할이 필요합니다.`,
      );
    }

    return true;
  }
}
