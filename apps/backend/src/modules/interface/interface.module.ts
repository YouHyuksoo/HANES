/**
 * @file src/modules/interface/interface.module.ts
 * @description ERP 인터페이스 모듈
 *
 * 주요 기능:
 * - ERP 작업지시 수신 (Inbound)
 * - BOM/품목 마스터 동기화 (Inbound)
 * - 생산실적 ERP 전송 (Outbound)
 * - 인터페이스 로그 관리
 * - 오류 재처리
 */

import { Module } from '@nestjs/common';
import { InterfaceController } from './controllers/interface.controller';
import { InterfaceService } from './services/interface.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InterfaceController],
  providers: [InterfaceService],
  exports: [InterfaceService],
})
export class InterfaceModule {}
