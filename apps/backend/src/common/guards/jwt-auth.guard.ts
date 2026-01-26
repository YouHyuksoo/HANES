/**
 * @file src/common/guards/jwt-auth.guard.ts
 * @description JWT 인증 가드 (기본 구조)
 *
 * 초보자 가이드:
 * 1. **목적**: JWT 토큰 기반 인증 검증
 * 2. **사용법**: 컨트롤러나 메서드에 @UseGuards(JwtAuthGuard) 데코레이터 적용
 * 3. **확장**: Supabase Auth 연동 시 실제 검증 로직 구현 필요
 *
 * TODO: Supabase Auth 연동 후 실제 JWT 검증 로직 구현
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * 인증된 사용자 정보 인터페이스
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role?: string;
}

/**
 * 인증된 요청 인터페이스
 */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('인증 토큰이 필요합니다.');
    }

    try {
      // TODO: Supabase Auth로 토큰 검증
      // const supabase = createClient(...)
      // const { data: { user }, error } = await supabase.auth.getUser(token)

      // 임시: 토큰이 존재하면 통과 (개발용)
      // 실제 구현 시 아래 주석 해제 및 수정
      const user: AuthenticatedUser = {
        id: 'temp-user-id',
        email: 'temp@example.com',
        role: 'user',
      };

      // 요청 객체에 사용자 정보 추가
      (request as AuthenticatedRequest).user = user;

      this.logger.debug(`User authenticated: ${user.email}`);
      return true;
    } catch (error) {
      this.logger.warn(`Authentication failed: ${(error as Error).message}`);
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }
  }

  /**
   * Authorization 헤더에서 Bearer 토큰 추출
   */
  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
