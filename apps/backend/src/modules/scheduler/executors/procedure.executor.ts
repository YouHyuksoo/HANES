/**
 * @file src/modules/scheduler/executors/procedure.executor.ts
 * @description PROCEDURE 실행기 - Oracle 패키지 프로시저를 호출하여 작업을 실행한다.
 *
 * 초보자 가이드:
 * 1. execTarget 형식: 'PKG_NAME.PROC_NAME' (예: 'PKG_INTERFACE.SP_SYNC_BOM')
 * 2. OracleService.callProc()를 사용하여 프로시저 호출
 * 3. execParams(JSON)를 IN 파라미터로 전달
 * 4. 반환된 커서 결과의 행 수를 affectedRows로 기록
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { IJobExecutor, ExecutorResult } from './executor.interface';
import { SchedulerJob } from '../../../entities/scheduler-job.entity';
import { OracleService } from '../../../common/services/oracle.service';

@Injectable()
export class ProcedureExecutor implements IJobExecutor {
  private readonly logger = new Logger(ProcedureExecutor.name);

  constructor(private readonly oracleService: OracleService) {}

  /**
   * Oracle 프로시저를 호출하여 작업을 실행한다.
   * @param job 스케줄러 작업 엔티티
   * @returns 실행 결과
   */
  async execute(job: SchedulerJob): Promise<ExecutorResult> {
    const { execTarget, execParams } = job;

    // execTarget을 PKG_NAME.PROC_NAME으로 분리
    const dotIndex = execTarget.indexOf('.');
    if (dotIndex === -1) {
      throw new BadRequestException(
        `잘못된 execTarget 형식입니다. 'PKG_NAME.PROC_NAME' 형태여야 합니다: ${execTarget}`,
      );
    }

    const pkgName = execTarget.substring(0, dotIndex);
    const procName = execTarget.substring(dotIndex + 1);

    // 파라미터 파싱
    let params: Record<string, unknown> | undefined;
    if (execParams) {
      try {
        params = JSON.parse(execParams) as Record<string, unknown>;
      } catch (error: unknown) {
        throw new BadRequestException(
          `execParams JSON 파싱 실패: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(`프로시저 실행: ${pkgName}.${procName}`);

    const rows = await this.oracleService.callProc(pkgName, procName, params);

    return {
      success: true,
      affectedRows: rows.length,
      message: `프로시저 실행 완료: ${pkgName}.${procName} (${rows.length}행)`,
    };
  }
}
