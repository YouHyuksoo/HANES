/**
 * @file src/common/modules/guard.module.ts
 * @description 전역 가드 모듈
 *
 * 초보자 가이드:
 * 1. JwtAuthGuard와 RolesGuard, InventoryFreezeGuard를 전역으로 제공
 * 2. 기존 모듈 개별 providers 등록을 줄여 가드 누락 위험을 제거
 * 3. TypeOrmModule을 re-export하여 User repository를 전역 제공
 *    → @UseGuards(JwtAuthGuard)를 쓰는 각 모듈이 User forFeature 없이도
 *      가드의 UserRepository 의존성을 해결할 수 있게 한다.
 */

import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { InventoryFreezeGuard } from '../guards/inventory-freeze.guard';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [
    // JwtAuthGuard를 전역 가드로 등록 — 모든 라우트 기본 인증 (@Public() 예외)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    RolesGuard,
    InventoryFreezeGuard,
  ],
  // RolesGuard·InventoryFreezeGuard는 @UseGuards로 쓰이므로 export 유지.
  // TypeOrmModule: 의존성 가드(InventoryFreezeGuard 등)의 User repository 전역 제공.
  exports: [RolesGuard, InventoryFreezeGuard, TypeOrmModule],
})
export class GuardModule {}
