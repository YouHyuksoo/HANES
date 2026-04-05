/**
 * @file src/modules/workflow/workflow.controller.ts
 * @description 워크플로우 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. GET /workflow/summary — 전체 워크플로우 노드별 건수 반환
 */
import { Controller, Get } from '@nestjs/common';
import { WorkflowService } from './workflow.service';

@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get('summary')
  async getSummary() {
    const data = await this.workflowService.getSummary();
    return { success: true, data };
  }
}
