/**
 * @file src/modules/scheduler/executors/sql.executor.ts
 * @description SQL 실행기 - SELECT 또는 DELETE 쿼리를 실행하여 작업을 수행한다.
 *
 * 초보자 가이드:
 * 1. execTarget: 실행할 SQL 문 (SELECT 또는 DELETE만 허용)
 * 2. execParams(JSON): Oracle :name 바인드 변수로 전달
 * 3. 보안: SQL_ALLOWED_PATTERN으로 시작 키워드 검증 + SQL_BLOCKED_KEYWORDS 차단
 * 4. DROP, TRUNCATE, ALTER 등 위험 키워드는 차단됨
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IJobExecutor, ExecutorResult } from './executor.interface';
import { SchedulerJob } from '../../../entities/scheduler-job.entity';
import {
  SQL_ALLOWED_PATTERN,
  SQL_BLOCKED_KEYWORDS,
} from '../config/scheduler-security.config';

@Injectable()
export class SqlExecutor implements IJobExecutor {
  private readonly logger = new Logger(SqlExecutor.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * SQL 쿼리를 실행한다.
   * @param job 스케줄러 작업 엔티티
   * @returns 실행 결과
   */
  async execute(job: SchedulerJob): Promise<ExecutorResult> {
    const { execTarget, execParams } = job;
    const sql = execTarget.trim();

    // SQL 시작 패턴 검증 (SELECT 또는 DELETE만 허용)
    if (!SQL_ALLOWED_PATTERN.test(sql)) {
      throw new ForbiddenException(
        'SELECT 또는 DELETE 쿼리만 허용됩니다.',
      );
    }

    // 차단 키워드 검사 (대소문자 무시)
    const upperSql = sql.toUpperCase();
    for (const keyword of SQL_BLOCKED_KEYWORDS) {
      if (upperSql.includes(keyword)) {
        throw new ForbiddenException(
          `차단된 SQL 키워드가 포함되어 있습니다: ${keyword}`,
        );
      }
    }

    // 바인드 파라미터 파싱
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

    this.logger.log(`SQL 실행: ${sql.substring(0, 100)}...`);

    // Oracle :name 바인드 사용 — params 객체를 직접 전달
    const result = await this.dataSource.query(sql, params ? Object.values(params) : undefined);

    const affectedRows = Array.isArray(result) ? result.length : 0;

    return {
      success: true,
      affectedRows,
      message: `SQL 실행 완료 (${affectedRows}행)`,
    };
  }
}
