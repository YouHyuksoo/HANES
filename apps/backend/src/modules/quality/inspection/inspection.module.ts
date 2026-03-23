/**
 * @file src/modules/quality/inspection/inspection.module.ts
 * @description 검사 관리 서브모듈
 *
 * @module InspectionModule
 * @description
 * 검사실적 및 검사 관련 기능을 위한 서브모듈입니다.
 * - InspectResult: 일반 검사실적 관리
 * - Trace: 추적성 조회 (4M 이력)
 *
 * @dependencies
 * - TypeOrmModule: InspectResult, ProdResult, TraceLog, FgLabel 등 엔티티
 * - SharedModule: SeqGeneratorService (채번)
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InspectResultController } from './controllers/inspect-result.controller';
import { TraceController } from './controllers/trace.controller';
import { InspectResultService } from './services/inspect-result.service';
import { TraceService } from './services/trace.service';
import { InspectResult } from '../../../entities/inspect-result.entity';
import { ProdResult } from '../../../entities/prod-result.entity';
import { TraceLog } from '../../../entities/trace-log.entity';
import { User } from '../../../entities/user.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { WorkerMaster } from '../../../entities/worker-master.entity';
import { ProcessMaster } from '../../../entities/process-master.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { ControlPlanItem } from '../../../entities/control-plan-item.entity';
import { SharedModule } from '../../../shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InspectResult,
      ProdResult,
      TraceLog,
      User,
      FgLabel,
      JobOrder,
      MatIssue,
      PartMaster,
      EquipMaster,
      WorkerMaster,
      ProcessMaster,
      MatLot,
      ControlPlanItem,
    ]),
    SharedModule, // SeqGeneratorService 제공
  ],
  controllers: [InspectResultController, TraceController],
  providers: [InspectResultService, TraceService],
  exports: [InspectResultService, TraceService],
})
export class InspectionModule {}
