/**
 * @file src/modules/dashboard/dashboard.module.ts
 * @description 대시보드 모듈 — OracleService를 통해 PKG_DASHBOARD 패키지 호출
 *
 * 초보자 가이드:
 * 1. OracleModule이 @Global()이므로 별도 import 불필요
 * 2. TypeORM 엔티티 import 제거 — 모든 데이터 조회는 Oracle 패키지 경유
 */
import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
