/**
 * @file src/common/modules/guard.module.ts
 * @description 전역 가드 모듈
 *
 * 초보자 가이드:
 * 1. JwtAuthGuard와 RolesGuard, InventoryFreezeGuard를 전역으로 제공
 * 2. 기존 모듈 개별 providers 등록을 줄여 가드 누락 위험을 제거
 */

import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { InventoryFreezeGuard } from '../guards/inventory-freeze.guard';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [JwtAuthGuard, RolesGuard, InventoryFreezeGuard],
  exports: [JwtAuthGuard, RolesGuard, InventoryFreezeGuard],
})
export class GuardModule {}
