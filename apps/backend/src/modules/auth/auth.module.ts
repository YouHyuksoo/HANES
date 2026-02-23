/**
 * @file src/modules/auth/auth.module.ts
 * @description 인증 모듈 - 로그인/회원가입/사용자 조회 + RBAC 권한 연동 + 활동 로깅
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from '../../entities/user.entity';
import { RoleModule } from '../role/role.module';
import { SystemModule } from '../system/system.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), RoleModule, SystemModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
