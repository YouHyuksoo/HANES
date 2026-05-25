/**
 * @file src/modules/quality/rework/rework.module.ts
 * @description 재작업 관리 서브모듈
 *
 * @module ReworkModule
 * @description
 * 재작업 관리를 위한 서브모듈입니다.
 * - ReworkOrder: 재작업 지시 관리
 * - ReworkProcess: 공정별 작업 관리
 * - ReworkResult: 공정별 실적 관리
 * - ReworkInspect: 재검사 관리
 *
 * @dependencies
 * - TypeOrmModule: ReworkOrder, ReworkProcess, ReworkResult, ReworkInspect, DefectLog 엔티티
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReworkController } from './controllers/rework.controller';
import { ReworkService } from './services/rework.service';
import { ReworkProcessService } from './services/rework-process.service';
import { ReworkOrder } from '../../../entities/rework-order.entity';
import { ReworkProcess } from '../../../entities/rework-process.entity';
import { ReworkResult } from '../../../entities/rework-result.entity';
import { ReworkInspect } from '../../../entities/rework-inspect.entity';
import { DefectLog } from '../../../entities/defect-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReworkOrder,
      ReworkProcess,
      ReworkResult,
      ReworkInspect,
      DefectLog,
    ]),
  ],
  controllers: [ReworkController],
  providers: [ReworkService, ReworkProcessService],
  exports: [ReworkService, ReworkProcessService],
})
export class ReworkModule {}
