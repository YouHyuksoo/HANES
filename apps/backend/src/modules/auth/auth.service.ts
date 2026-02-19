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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { LoginDto, RegisterDto } from './auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * 로그인 - DB에서 email/password 직접 체크
   * @returns userId를 토큰으로 사용
   */
  async login(dto: LoginDto) {
    this.logger.debug(`Login attempt: email=${dto.email}`);
    
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    this.logger.debug(`User found: ${user ? 'YES' : 'NO'}`);
    
    if (!user) {
      this.logger.warn(`Login failed: User not found - ${dto.email}`);
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    this.logger.debug(`User status: ${user.status}, Role: ${user.role}`);

    if (user.status !== 'ACTIVE') {
      this.logger.warn(`Login failed: Inactive account - ${dto.email}, status=${user.status}`);
      throw new UnauthorizedException('비활성화된 계정입니다. 관리자에게 문의하세요.');
    }

    this.logger.debug(`Password check: DB='${user.password}', Input='${dto.password}'`);
    
    if (user.password !== dto.password) {
      this.logger.warn(`Login failed: Password mismatch - ${dto.email}`);
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    // 최근 로그인 시간 업데이트
    await this.userRepository.update(user.id, { lastLoginAt: new Date() });

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
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('이미 등록된 이메일입니다.');
    }

    const user = this.userRepository.create({
      email: dto.email,
      password: dto.password,
      name: dto.name,
      empNo: dto.empNo,
      dept: dto.dept,
      role: 'OPERATOR', // 기본 역할
    });

    const savedUser = await this.userRepository.save(user);

    this.logger.log(`User registered: ${savedUser.email}`);

    return {
      token: savedUser.id,
      user: {
        id: savedUser.id,
        email: savedUser.email,
        name: savedUser.name,
        empNo: savedUser.empNo,
        dept: savedUser.dept,
        role: savedUser.role,
        status: savedUser.status,
      },
    };
  }

  /**
   * 현재 사용자 조회 - Bearer 토큰(userId)으로 사용자 조회
   */
  async me(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        'id',
        'email',
        'name',
        'empNo',
        'dept',
        'role',
        'status',
        'company',
        'lastLoginAt',
      ],
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
