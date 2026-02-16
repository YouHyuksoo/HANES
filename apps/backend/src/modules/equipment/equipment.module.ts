/**
 * @file src/modules/equipment/equipment.module.ts
 * @description 설비관리 모듈 - 설비마스터, 소모품, 일상/정기 점검, 점검이력 관리
 *
 * 초보자 가이드:
 * 1. **목적**: 생산 설비 및 소모품 관리 기능 제공
 * 2. **주요 기능**:
 *    - 설비 마스터 CRUD
 *    - 설비 상태 관리 (NORMAL, MAINT, STOP)
 *    - 소모품 마스터 CRUD
 *    - 일상점검 (DAILY) CRUD
 *    - 정기점검 (PERIODIC) CRUD
 *    - 점검이력 조회 (전체 통합)
 *
 * API 엔드포인트:
 * - /api/v1/equipment/equips : 설비 마스터
 * - /api/v1/equipment/consumables : 소모품
 * - /api/v1/equipment/daily-inspect : 일상점검
 * - /api/v1/equipment/periodic-inspect : 정기점검
 * - /api/v1/equipment/inspect-history : 점검이력 조회
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipMaster } from '../../entities/equip-master.entity';
import { EquipInspectItemMaster } from '../../entities/equip-inspect-item-master.entity';
import { EquipInspectLog } from '../../entities/equip-inspect-log.entity';
import { ConsumableMaster } from '../../entities/consumable-master.entity';
import { ConsumableLog } from '../../entities/consumable-log.entity';
import { EquipMasterController } from './controllers/equip-master.controller';
import { ConsumableController, ConsumableLogController } from './controllers/consumable.controller';
import { DailyInspectController } from './controllers/daily-inspect.controller';
import { PeriodicInspectController } from './controllers/periodic-inspect.controller';
import { InspectHistoryController } from './controllers/inspect-history.controller';
import { EquipMasterService } from './services/equip-master.service';
import { ConsumableService } from './services/consumable.service';
import { EquipInspectService } from './services/equip-inspect.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EquipMaster,
      EquipInspectItemMaster,
      EquipInspectLog,
      ConsumableMaster,
      ConsumableLog,
    ]),
  ],
  controllers: [
    EquipMasterController,
    ConsumableController,
    ConsumableLogController,
    DailyInspectController,
    PeriodicInspectController,
    InspectHistoryController,
  ],
  providers: [
    EquipMasterService,
    ConsumableService,
    EquipInspectService,
  ],
  exports: [
    EquipMasterService,
    ConsumableService,
    EquipInspectService,
  ],
})
export class EquipmentModule {}
