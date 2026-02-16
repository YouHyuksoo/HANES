/**
 * @file src/modules/auth/auth.service.ts
 * @description 인증 서비스 - DB 직접 비밀번호 체크 방식 (JWT 라이브러리 없음)
 *
 * 초보자 가이드:
 * 1. **login**: email/password DB 체크 → userId를 토큰으로 반환
 * 2. **register**: 신규 사용자 등록
 * 3. **me**: userId(토큰)로 현재 사용자 조회
 */
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 로그인 - DB에서 email/password 직접 체크
   * @returns userId를 토큰으로 사용
   */
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('비활성화된 계정입니다. 관리자에게 문의하세요.');
    }

    if (user.password !== dto.password) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    // 최근 로그인 시간 업데이트
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.logger.log(`User logged in: ${user.email}`);

    // 로그인 시 선택한 회사 또는 사용자 기본 회사 사용
    const selectedCompany = dto.company || user.company || '';

    return {
      token: user.id, // userId를 토큰으로 사용
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        empNo: user.empNo,
        dept: user.dept,
        role: user.role,
        status: user.status,
        company: selectedCompany,
      },
    };
  }

  /**
   * 회원가입 - 새 사용자 DB에 등록
   */
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('이미 등록된 이메일입니다.');
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: dto.password,
        name: dto.name,
        empNo: dto.empNo,
        dept: dto.dept,
        role: 'OPERATOR', // 기본 역할
      },
    });

    this.logger.log(`User registered: ${user.email}`);

    return {
      token: user.id,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        empNo: user.empNo,
        dept: user.dept,
        role: user.role,
        status: user.status,
      },
    };
  }

  /**
   * 현재 사용자 조회 - Bearer 토큰(userId)으로 사용자 조회
   */
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        empNo: true,
        dept: true,
        role: true,
        status: true,
        company: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('비활성화된 계정입니다.');
    }

    return user;
  }
}
