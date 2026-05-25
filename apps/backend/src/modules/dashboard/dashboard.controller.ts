/**
 * @file src/modules/dashboard/dashboard.controller.ts
 * @description 대시보드 컨트롤러 - KPI 및 최근 생산 현황 API
 *
 * 초보자 가이드:
 * 1. GET /dashboard/kpi - 오늘 생산량, 재고현황, 품질합격률, 불량건수 반환
 * 2. GET /dashboard/recent-productions - 최근 작업지시 10건 반환
 */

import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Company, Plant } from '../../common/decorators/tenant.decorator';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('kpi')
  async getKpi(@Company() company: string, @Plant() plant: string) {
    const data = await this.dashboardService.getKpi(company, plant);
    return { success: true, data };
  }

  @Get('summary')
  async getSummary(
    @Query('date') date: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.dashboardService.getSummary(date, company, plant);
    return { success: true, data };
  }

  @Get('recent-productions')
  async getRecentProductions(@Company() company: string, @Plant() plant: string) {
    const data = await this.dashboardService.getRecentProductions(company, plant);
    return { success: true, data };
  }
}
