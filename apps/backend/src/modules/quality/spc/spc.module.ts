/**
 * @file src/modules/quality/spc/spc.module.ts
 * @description SPC/MSA/관리도 관리 서브모듈
 *
 * @module SpcModule
 * @description
 * SPC(Statistical Process Control) 통계적 공정관리를 위한 서브모듈입니다.
 * - SpcChart: 관리도 마스터
 * - SpcData: 관리도 데이터
 * - GaugeMaster: 계측기 마스터
 * - CalibrationLog: 교정 이력
 * - ControlPlan/ControlPlanItem: 관리계획서
 * - ProcessMaster: 공정 마스터
 *
 * @dependencies
 * - TypeOrmModule: SpcChart, SpcData, GaugeMaster, CalibrationLog, ControlPlan, ControlPlanItem, ProcessMaster 엔티티
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemModule } from '../../system/system.module';

// Controllers
import { SpcController } from './controllers/spc.controller';
import { MsaController } from './controllers/msa.controller';
import { ControlPlanController } from './controllers/control-plan.controller';
import { HvSpcController } from './hv/hv-spc.controller';

// Services
import { SpcService } from './services/spc.service';
import { MsaService } from './services/msa.service';
import { ControlPlanService } from './services/control-plan.service';
import { HvSpcService } from './hv/hv-spc.service';

// Entities
import { SpcChart } from '../../../entities/spc-chart.entity';
import { SpcData } from '../../../entities/spc-data.entity';
import { ProcessMaster } from '../../../entities/process-master.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { GaugeMaster } from '../../../entities/gauge-master.entity';
import { CalibrationLog } from '../../../entities/calibration-log.entity';
import { ControlPlan } from '../../../entities/control-plan.entity';
import { ControlPlanItem } from '../../../entities/control-plan-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SpcChart,
      SpcData,
      ProcessMaster,
      ItemMaster,
      GaugeMaster,
      CalibrationLog,
      ControlPlan,
      ControlPlanItem,
    ]),
    // HV SPC 소스 전환 설정(SPC_HV_SOURCE) 조회용 SysConfigService
    SystemModule,
  ],
  controllers: [
    SpcController,
    MsaController,
    ControlPlanController,
    HvSpcController,
  ],
  providers: [
    SpcService,
    MsaService,
    ControlPlanService,
    HvSpcService,
  ],
  exports: [
    SpcService,
    MsaService,
    ControlPlanService,
  ],
})
export class SpcModule {}
