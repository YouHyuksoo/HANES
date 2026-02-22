/**
 * @file src/modules/dashboard/dashboard.controller.ts
 * @description 대시보드 컨트롤러 - KPI 및 최근 생산 현황 API
 *
 * 초보자 가이드:
 * 1. GET /dashboard/kpi - 오늘 생산량, 재고현황, 품질합격률, 불량건수 반환
 * 2. GET /dashboard/recent-productions - 최근 작업지시 10건 반환
 */

import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('kpi')
  async getKpi() {
    const data = await this.dashboardService.getKpi();
    return { success: true, data };
  }

  @Get('recent-productions')
  async getRecentProductions() {
    const data = await this.dashboardService.getRecentProductions();
    return { success: true, data };
  }
}
