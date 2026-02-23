/**
 * @file src/modules/role/role.module.ts
 * @description 역할 관리 모듈
 *
 * 초보자 가이드:
 * 1. **TypeOrmModule.forFeature**: Role, RoleMenuPermission 엔티티 등록
 * 2. **exports**: RoleService를 외부 모듈(AuthModule 등)에서 사용할 수 있도록 내보냄
 * 3. **AuthModule**: 로그인 시 역할별 허용 메뉴를 조회하기 위해 RoleService 필요
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { Role } from '../../entities/role.entity';
import { RoleMenuPermission } from '../../entities/role-menu-permission.entity';
import { User } from '../../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Role, RoleMenuPermission, User])],
  controllers: [RoleController],
  providers: [RoleService],
  exports: [RoleService],
})
export class RoleModule {}
