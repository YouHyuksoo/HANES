/**
 * @file src/common/guards/jwt-auth.guard.ts
 * @description 인증 가드 - Bearer 토큰(userId)으로 사용자 확인
 *
 * 초보자 가이드:
 * 1. **목적**: Bearer 토큰(userId)을 DB에서 검증
 * 2. **사용법**: 컨트롤러나 메서드에 @UseGuards(JwtAuthGuard) 데코레이터 적용
 * 3. **토큰**: userId를 그대로 토큰으로 사용 (JWT 라이브러리 없음)
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 인증된 사용자 정보 인터페이스
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role?: string;
  company?: string;
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

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('인증 토큰이 필요합니다.');
    }

    try {
      // DB에서 userId로 사용자 조회
      const user = await this.prisma.user.findUnique({
        where: { id: token },
        select: { id: true, email: true, role: true, status: true, company: true },
      });

      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedException('유효하지 않은 토큰입니다.');
      }

      // X-Company 헤더에서 회사 코드 추출 (프론트엔드가 설정)
      const companyHeader = request.headers['x-company'] as string | undefined;

      // 요청 객체에 사용자 정보 추가
      (request as AuthenticatedRequest).user = {
        id: user.id,
        email: user.email,
        role: user.role,
        company: companyHeader || user.company || undefined,
      };

      this.logger.debug(`User authenticated: ${user.email}`);
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
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
