/**
 * @file src/modules/workflow/workflow.service.ts
 * @description 워크플로우 서비스 — PKG_WORKFLOW Oracle 패키지 호출
 *
 * 초보자 가이드:
 * 1. OracleService.callProc()로 PKG_WORKFLOW.SP_WORKFLOW_SUMMARY 호출
 * 2. 결과를 workflowId → nodeId → counts 맵으로 변환하여 프론트엔드에 전달
 */
import { Injectable } from '@nestjs/common';
import { OracleService } from '../../common/services/oracle.service';

const PKG = 'PKG_WORKFLOW';

export interface NodeCount {
  pendingCnt: number;
  activeCnt: number;
  doneCnt: number;
  reverseCnt: number;
}

@Injectable()
export class WorkflowService {
  constructor(private readonly oracle: OracleService) {}

  async getSummary(): Promise<Record<string, Record<string, NodeCount>>> {
    const rows = await this.oracle.callProc<any>(PKG, 'SP_WORKFLOW_SUMMARY');

    const result: Record<string, Record<string, NodeCount>> = {};
    for (const row of rows) {
      const wfId = row.workflowId ?? '';
      const nodeId = row.nodeId ?? '';
      if (!result[wfId]) result[wfId] = {};
      result[wfId][nodeId] = {
        pendingCnt: row.pendingCnt ?? 0,
        activeCnt: row.activeCnt ?? 0,
        doneCnt: row.doneCnt ?? 0,
        reverseCnt: row.reverseCnt ?? 0,
      };
    }
    return result;
  }
}
