/**
 * @file src/modules/quality/quality.module.ts
 * @description 품질관리 모듈 - 검사실적, 불량로그, 수리이력, OQC(출하검사) 관리
 *
 * 초보자 가이드:
 * 1. **목적**: 품질 검사 및 불량 관리 기능
 * 2. **주요 기능**:
 *    - 검사실적 관리 (통전검사, 외관검사, 치수검사 등)
 *    - 불량 등록/추적/처리
 *    - 수리 이력 관리
 *    - OQC(출하검사) 의뢰/검사/판정
 *    - 합격률/불량률 통계
 *
 * 컨트롤러:
 * - InspectResultController: 검사실적 API (/quality/inspect-results)
 * - DefectLogController: 불량로그 API (/quality/defect-logs)
 * - OqcController: OQC 출하검사 API (/quality/oqc)
 *
 * 서비스:
 * - InspectResultService: 검사실적 비즈니스 로직
 * - DefectLogService: 불량로그/수리이력 비즈니스 로직
 * - OqcService: OQC 출하검사 비즈니스 로직
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InspectResultController } from './controllers/inspect-result.controller';
import { InspectResultService } from './services/inspect-result.service';
import { DefectLogController } from './controllers/defect-log.controller';
import { DefectLogService } from './services/defect-log.service';
import { OqcController } from './controllers/oqc.controller';
import { OqcService } from './services/oqc.service';
import { DefectLog } from '../../entities/defect-log.entity';
import { RepairLog } from '../../entities/repair-log.entity';
import { InspectResult } from '../../entities/inspect-result.entity';
import { ProdResult } from '../../entities/prod-result.entity';
import { OqcRequest } from '../../entities/oqc-request.entity';
import { OqcRequestBox } from '../../entities/oqc-request-box.entity';
import { BoxMaster } from '../../entities/box-master.entity';
import { PartMaster } from '../../entities/part-master.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DefectLog,
      RepairLog,
      InspectResult,
      ProdResult,
      OqcRequest,
      OqcRequestBox,
      BoxMaster,
      PartMaster,
    ]),
  ],
  controllers: [
    InspectResultController,
    DefectLogController,
    OqcController,
  ],
  providers: [
    InspectResultService,
    DefectLogService,
    OqcService,
  ],
  exports: [
    InspectResultService,
    DefectLogService,
    OqcService,
  ],
})
export class QualityModule {}
