/**
 * @file src/modules/equipment/equipment.module.ts
 * @description 설비관리 모듈 - 설비마스터 및 소모품(금형/지그/공구) 관리
 *
 * 초보자 가이드:
 * 1. **목적**: 생산 설비 및 소모품 관리 기능 제공
 * 2. **주요 기능**:
 *    - 설비 마스터 CRUD
 *    - 설비 상태 관리 (NORMAL, MAINT, STOP)
 *    - 라인별/유형별 설비 조회
 *    - 소모품 마스터 CRUD
 *    - 소모품 수명 관리 (사용 횟수, 교체 주기)
 *    - 소모품 입출고 이력 관리
 *
 * 컨트롤러:
 * - EquipMasterController: 설비 API
 * - ConsumableController: 소모품 API
 * - ConsumableLogController: 소모품 로그 API
 *
 * 서비스:
 * - EquipMasterService: 설비 비즈니스 로직
 * - ConsumableService: 소모품 비즈니스 로직
 */

import { Module } from '@nestjs/common';
import { EquipMasterController } from './controllers/equip-master.controller';
import { ConsumableController, ConsumableLogController } from './controllers/consumable.controller';
import { EquipMasterService } from './services/equip-master.service';
import { ConsumableService } from './services/consumable.service';

@Module({
  imports: [],
  controllers: [
    EquipMasterController,
    ConsumableController,
    ConsumableLogController,
  ],
  providers: [
    EquipMasterService,
    ConsumableService,
  ],
  exports: [
    EquipMasterService,
    ConsumableService,
  ],
})
export class EquipmentModule {}
