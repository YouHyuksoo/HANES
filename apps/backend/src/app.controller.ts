/**
 * @file src/app.controller.ts
 * @description 앱 루트 컨트롤러 — 헬스체크 및 DB 상태 모니터링
 *
 * 초보자 가이드:
 * 1. GET / → Hello World (서버 살아있는지 확인)
 * 2. GET /health → DB 연결 상태 포함 상세 헬스체크
 */

import { Controller, Get, Logger } from '@nestjs/common';
import { AppService } from './app.service';
import { DataSource } from 'typeorm';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly appService: AppService,
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async getHealth() {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();

    // DB 연결 상태 확인
    let dbStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
    let dbLatencyMs: number | null = null;
    let dbError: string | null = null;

    try {
      if (this.dataSource.isInitialized) {
        const start = Date.now();
        await this.dataSource.query('SELECT 1 FROM DUAL');
        dbLatencyMs = Date.now() - start;
        dbStatus = 'connected';
      }
    } catch (e: any) {
      dbStatus = 'error';
      dbError = e.message;
      this.logger.warn(`Health check DB 오류: ${e.message}`);
    }

    return {
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        error: dbError,
      },
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      },
    };
  }
}
