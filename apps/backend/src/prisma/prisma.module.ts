/**
 * @file src/prisma/prisma.module.ts
 * @description Prisma 모듈 - 글로벌 DB 접근 제공
 *
 * 초보자 가이드:
 * 1. **Global**: 앱 전체에서 PrismaService 사용 가능
 * 2. **Import**: AppModule에서 한 번만 import
 * 3. **사용**: 다른 모듈에서 별도 import 없이 PrismaService 주입 가능
 */

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
