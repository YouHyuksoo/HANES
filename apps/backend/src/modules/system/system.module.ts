/**
 * @file src/modules/system/system.module.ts
 * @description 시스템관리 모듈 - 통신설정, 환경설정, 활동 로그, 교육훈련, 문서관리 등
 *
 * 초보자 가이드:
 * 1. **CommConfig**: 통신설정 API 엔드포인트 및 비즈니스 로직
 * 2. **SerialTest**: 시리얼 포트 목록 조회 및 통신 테스트
 * 3. **SysConfig**: 환경설정 API (선입선출, 장기재고 등 시스템 옵션 관리)
 * 4. **ActivityLog**: 사용자 활동 로그 (로그인/페이지 접속 기록)
 * 5. **Training**: 교육훈련 계획/결과 관리 (IATF 16949 7.2)
 * 6. **Document**: 문서관리 (IATF 16949 7.5)
 * 7. 다른 모듈에서 SysConfigService, ActivityLogService를 주입하여 사용 가능
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommConfigController } from './controllers/comm-config.controller';
import { CommConfigService } from './services/comm-config.service';
import { SerialTestService } from './services/serial-test.service';
import { CommConfig } from '../../entities/comm-config.entity';
import { SysConfigController } from './controllers/sys-config.controller';
import { SysConfigService } from './services/sys-config.service';
import { SysConfig } from '../../entities/sys-config.entity';
import { ActivityLogController } from './controllers/activity-log.controller';
import { ActivityLogService } from './services/activity-log.service';
import { ActivityLog } from '../../entities/activity-log.entity';
import { TrainingController } from './controllers/training.controller';
import { TrainingService } from './services/training.service';
import { TrainingPlan } from '../../entities/training-plan.entity';
import { TrainingResult } from '../../entities/training-result.entity';
import { DocumentController } from './controllers/document.controller';
import { DocumentService } from './services/document.service';
import { DocumentMaster } from '../../entities/document-master.entity';
import { PdaRole } from '../../entities/pda-role.entity';
import { PdaRoleMenu } from '../../entities/pda-role-menu.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CommConfig,
      SysConfig,
      ActivityLog,
      TrainingPlan,
      TrainingResult,
      DocumentMaster,
      PdaRole,
      PdaRoleMenu,
    ]),
  ],
  controllers: [
    CommConfigController,
    SysConfigController,
    ActivityLogController,
    TrainingController,
    DocumentController,
  ],
  providers: [
    CommConfigService,
    SerialTestService,
    SysConfigService,
    ActivityLogService,
    TrainingService,
    DocumentService,
  ],
  exports: [
    CommConfigService,
    SysConfigService,
    ActivityLogService,
    TrainingService,
    DocumentService,
  ],
})
export class SystemModule {}
