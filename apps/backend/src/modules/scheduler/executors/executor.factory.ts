/**
 * @file src/modules/scheduler/executors/executor.factory.ts
 * @description 스케줄러 실행기 팩토리 - execType에 따라 적절한 Executor를 반환한다.
 *
 * 초보자 가이드:
 * 1. **get(execType)**: 실행 유형 문자열로 해당 Executor 인스턴스를 반환
 * 2. 등록된 유형: SERVICE, PROCEDURE, SQL, HTTP, SCRIPT
 * 3. 미등록 유형이면 BadRequestException 발생
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { IJobExecutor } from './executor.interface';
import { ServiceExecutor } from './service.executor';
import { ProcedureExecutor } from './procedure.executor';
import { SqlExecutor } from './sql.executor';
import { HttpExecutor } from './http.executor';
import { ScriptExecutor } from './script.executor';

@Injectable()
export class ExecutorFactory {
  /** execType → Executor 매핑 */
  private readonly executorMap: Map<string, IJobExecutor>;

  constructor(
    private readonly serviceExecutor: ServiceExecutor,
    private readonly procedureExecutor: ProcedureExecutor,
    private readonly sqlExecutor: SqlExecutor,
    private readonly httpExecutor: HttpExecutor,
    private readonly scriptExecutor: ScriptExecutor,
  ) {
    this.executorMap = new Map<string, IJobExecutor>([
      ['SERVICE', this.serviceExecutor],
      ['PROCEDURE', this.procedureExecutor],
      ['SQL', this.sqlExecutor],
      ['HTTP', this.httpExecutor],
      ['SCRIPT', this.scriptExecutor],
    ]);
  }

  /**
   * 실행 유형에 해당하는 Executor를 반환한다.
   * @param execType 실행 유형 (SERVICE/PROCEDURE/SQL/HTTP/SCRIPT)
   * @returns 해당 Executor 인스턴스
   * @throws BadRequestException 미등록 실행 유형인 경우
   */
  get(execType: string): IJobExecutor {
    const executor = this.executorMap.get(execType);
    if (!executor) {
      throw new BadRequestException(
        `지원하지 않는 실행 유형입니다: ${execType}`,
      );
    }
    return executor;
  }
}
