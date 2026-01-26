/**
 * @file src/prisma/prisma.service.ts
 * @description Prisma 클라이언트 서비스
 *
 * 초보자 가이드:
 * 1. **목적**: Prisma Client를 NestJS에서 사용할 수 있도록 래핑
 * 2. **연결 관리**: 앱 시작/종료 시 DB 연결 자동 관리
 * 3. **사용법**: 서비스에서 PrismaService 주입받아 사용
 */

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    this.logger.log('Connecting to database...');
    await this.$connect();
    this.logger.log('Database connected successfully');
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}
