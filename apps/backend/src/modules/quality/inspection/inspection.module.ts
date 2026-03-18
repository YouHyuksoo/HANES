/**
 * @file src/modules/quality/inspection/inspection.module.ts
 * @description 검사 관리 서브모듈
 *
 * @module InspectionModule
 * @description
 * 검사실적 및 검사 관련 기능을 위한 서브모듈입니다.
 * - InspectResult: 일반 검사실적 관리
 *
 * @dependencies
 * - TypeOrmModule: InspectResult, ProdResult, TraceLog 엔티티
 * - SharedModule: SeqGeneratorService (채번)
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InspectResultController } from './controllers/inspect-result.controller';
import { InspectResultService } from './services/inspect-result.service';
import { InspectResult } from '../../../entities/inspect-result.entity';
import { ProdResult } from '../../../entities/prod-result.entity';
import { TraceLog } from '../../../entities/trace-log.entity';
import { SharedModule } from '../../../shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InspectResult,
      ProdResult,
      TraceLog,
    ]),
    SharedModule, // SeqGeneratorService 제공
  ],
  controllers: [InspectResultController],
  providers: [InspectResultService],
  exports: [InspectResultService],
})
export class InspectionModule {}
