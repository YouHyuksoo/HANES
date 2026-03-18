/**
 * @file src/modules/quality/defects/defects.module.ts
 * @description 불량/수리 관리 서브모듈
 *
 * @module DefectsModule
 * @description
 * 불량 로그 및 수리 이력 관리를 위한 서브모듈입니다.
 * - DefectLog: 불량 발생 정보 관리
 * - RepairLog: 수리 이력 관리
 *
 * @dependencies
 * - TypeOrmModule: DefectLog, RepairLog, ProdResult 엔티티
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DefectLogController } from './controllers/defect-log.controller';
import { DefectLogService } from './services/defect-log.service';
import { DefectLog } from '../../../entities/defect-log.entity';
import { RepairLog } from '../../../entities/repair-log.entity';
import { ProdResult } from '../../../entities/prod-result.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DefectLog,
      RepairLog,
      ProdResult,
    ]),
  ],
  controllers: [DefectLogController],
  providers: [DefectLogService],
  exports: [DefectLogService],
})
export class DefectsModule {}
