/**
 * @file src/modules/print-agent/print-agent.module.ts
 * @description HANES Print Agent 실행파일 배포 모듈 (info/download 엔드포인트).
 */
import { Module } from '@nestjs/common';
import { PrintAgentController } from './print-agent.controller';

@Module({
  controllers: [PrintAgentController],
})
export class PrintAgentModule {}
