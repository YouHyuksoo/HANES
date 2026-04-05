/**
 * @file src/modules/workflow/workflow.module.ts
 * @description 워크플로우 모듈
 *
 * 초보자 가이드:
 * 1. OracleModule이 @Global()이므로 별도 import 불필요
 */
import { Module } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';

@Module({
  controllers: [WorkflowController],
  providers: [WorkflowService],
})
export class WorkflowModule {}
