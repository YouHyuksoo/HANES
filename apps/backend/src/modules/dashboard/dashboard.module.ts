/**
 * @file src/modules/dashboard/dashboard.module.ts
 * @description 대시보드 모듈 - KPI 요약 및 최근 생산 현황 API
 *
 * 초보자 가이드:
 * 1. **목적**: 메인 대시보드에 표시할 KPI 데이터와 최근 작업지시 목록 제공
 * 2. **엔드포인트**:
 *    - GET /dashboard/kpi : 오늘 생산량, 재고, 품질 합격률, 불량 건수
 *    - GET /dashboard/recent-productions : 최근 작업지시 10건
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

import { JobOrder } from '../../entities/job-order.entity';
import { ProdResult } from '../../entities/prod-result.entity';
import { MatStock } from '../../entities/mat-stock.entity';
import { InspectResult } from '../../entities/inspect-result.entity';
import { DefectLog } from '../../entities/defect-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      JobOrder,
      ProdResult,
      MatStock,
      InspectResult,
      DefectLog,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
