/**
 * @file src/modules/auth/auth.controller.ts
 * @description 인증 API 엔드포인트
 *
 * 엔드포인트:
 * - POST /api/auth/login  - 로그인
 * - POST /api/auth/register - 회원가입
 * - GET  /api/auth/me     - 현재 사용자 조회 (토큰 필요)
 */
import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';

@ApiTags('인증')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: '로그인' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('register')
  @ApiOperation({ summary: '회원가입' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get('me')
  @ApiOperation({ summary: '현재 사용자 조회' })
  async me(@Req() req: Request) {
    const token = this.extractToken(req);
    if (!token) {
      throw new UnauthorizedException('인증 토큰이 필요합니다.');
    }
    return this.authService.me(token);
  }

  private extractToken(req: Request): string | undefined {
    const authHeader = req.headers.authorization;
    if (!authHeader) return undefined;
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
