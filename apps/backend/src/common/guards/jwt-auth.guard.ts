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
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { User } from '../../entities/user.entity';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { getErrorMessage } from '../utils/error-message.util';
import { RequestUser, RequestWithUser, setRequestUser } from '../utils/request-user.util';

const READONLY_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** 유저 캐시 엔트리 */
interface CachedUser {
  user: RequestUser;
  expiresAt: number;
}

const USER_CACHE_TTL_MS = 60_000; // 60초

/**
 * 인증된 사용자 정보 인터페이스
 */
export type AuthenticatedUser = RequestUser;
export type AuthenticatedRequest = RequestWithUser & { user: AuthenticatedUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  // 모든 요청마다 DB를 치지 않도록 인메모리 캐시 (TTL 60초)
  private readonly cache = new Map<string, CachedUser>();

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // @Public() 데코레이터가 붙은 핸들러/컨트롤러는 인증 건너뜀
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('인증 토큰이 필요합니다.');
    }

    try {
      // X-Company, X-Plant 헤더에서 회사/사업장 코드 추출 (프론트엔드가 설정)
      const companyHeader = request.headers['x-company'] as string | undefined;
      const plantHeader = request.headers['x-plant'] as string | undefined;

      const cacheKey = `${token}|${companyHeader ?? ''}|${plantHeader ?? ''}`;
      const now = Date.now();
      const cached = this.cache.get(cacheKey);

      let resolvedUser: RequestUser;

      if (cached && cached.expiresAt > now) {
        resolvedUser = cached.user;
      } else {
        // 만료됐거나 없으면 DB 조회
        const user = await this.userRepository.findOne({
          where: {
            email: token,
            ...(companyHeader ? { company: companyHeader } : {}),
            ...(plantHeader ? { plant: plantHeader } : {}),
          },
          select: ['email', 'role', 'status', 'company', 'plant'],
        });

        if (!user || user.status !== 'ACTIVE') {
          this.cache.delete(cacheKey);
          throw new UnauthorizedException('유효하지 않은 토큰입니다.');
        }

        const resolvedCompany = companyHeader || user.company;
        const resolvedPlant = plantHeader || user.plant;

        if (!resolvedCompany || !resolvedPlant) {
          throw new UnauthorizedException('회사/사업장 정보가 없습니다. 재로그인 해주세요.');
        }

        resolvedUser = {
          id: user.email,
          email: user.email,
          role: user.role,
          company: resolvedCompany,
          plant: resolvedPlant,
        };
        this.cache.set(cacheKey, { user: resolvedUser, expiresAt: now + USER_CACHE_TTL_MS });

        // 오래된 항목 주기적으로 정리 (캐시가 500개 초과 시)
        if (this.cache.size > 500) {
          for (const [k, v] of this.cache) {
            if (v.expiresAt <= now) this.cache.delete(k);
          }
        }
      }

      const resolvedCompany = resolvedUser.company;
      const resolvedPlant = resolvedUser.plant;

      if (!resolvedCompany || !resolvedPlant) {
        throw new UnauthorizedException('회사/사업장 정보가 없습니다. 재로그인 해주세요.');
      }

      // 요청 객체에 사용자 정보 추가
      setRequestUser(request, resolvedUser);

      if (
        resolvedUser.role === 'VIEWER' &&
        !READONLY_HTTP_METHODS.has(request.method.toUpperCase())
      ) {
        throw new ForbiddenException('VIEWER role is read-only.');
      }

      this.logger.debug(`User authenticated: ${resolvedUser.email}`);
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) throw error;
      this.logger.warn(`Authentication failed: ${getErrorMessage(error)}`);
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
