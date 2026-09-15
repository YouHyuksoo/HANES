/**
 * @file src/modules/quality/continuity-inspect/continuity-inspect.module.ts
 * @description 통전검사 관리 서브모듈
 *
 * @module ContinuityInspectModule
 * @description
 * 통전검사 및 FG 라벨 발행 관리를 위한 서브모듈입니다.
 * - InspectResult: 검사실적 등록
 * - FgLabel: FG 라벨/바코드 관리
 * - JobOrder: 작업지시 연동
 * - EquipProtocol: 검사장비 프로토콜 관리
 *
 * @dependencies
 * - TypeOrmModule: InspectResult, FgLabel, JobOrder, EquipProtocol 엔티티
 * - SharedModule: SeqGeneratorService (채번)
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContinuityInspectController } from './controllers/continuity-inspect.controller';
import { ContinuityInspectService } from './services/continuity-inspect.service';
import { InspectResult } from '../../../entities/inspect-result.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { EquipProtocol } from '../../../entities/equip-protocol.entity';
import { ProdResult } from '../../../entities/prod-result.entity';
import { InspectItemSpec } from '../../../entities/inspect-item-spec.entity';
import { InspectAid } from '../../../entities/inspect-aid.entity';
import { InspectSampleCheck } from '../../../entities/inspect-sample-check.entity';
import { InspectSampleCheckItem } from '../../../entities/inspect-sample-check-item.entity';
import { ShiftPattern } from '../../../entities/shift-pattern.entity';
import { InspectSampleCheckService } from './services/inspect-sample-check.service';
import { EquipmentModule } from '../../equipment/equipment.module';
import { SharedModule } from '../../../shared/shared.module';
import { SystemModule } from '../../system/system.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InspectResult,
      FgLabel,
      JobOrder,
      EquipProtocol,
      ProdResult,
      InspectItemSpec,
      InspectAid,
      InspectSampleCheck,
      InspectSampleCheckItem,
      ShiftPattern,
    ]),
    SharedModule,
    SystemModule,
    EquipmentModule,
  ],
  controllers: [ContinuityInspectController],
  providers: [ContinuityInspectService, InspectSampleCheckService],
  exports: [ContinuityInspectService, InspectSampleCheckService],
})
export class ContinuityInspectModule {}
