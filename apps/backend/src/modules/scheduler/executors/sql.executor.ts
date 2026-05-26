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
import { getErrorMessage } from '../../../common/utils/error-message.util';
import { parseJsonRecord } from '../../../common/utils/json-record.util';
import {
  SQL_ALLOWED_PATTERN,
  SQL_BLOCKED_KEYWORDS,
} from '../config/scheduler-security.config';

interface SqlQueryDataSource {
  query<T = unknown>(query: string, parameters?: Record<string, unknown> | unknown[]): Promise<T>;
}

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
        params = parseJsonRecord(execParams);
      } catch (error: unknown) {
        throw new BadRequestException(
          `execParams JSON 파싱 실패: ${getErrorMessage(error)}`,
        );
      }
    }

    const namedBinds = this.extractNamedBinds(sql);
    const tenantParams = this.extractTenantBindParams(namedBinds, job);
    const isDelete = /^\s*DELETE\s/i.test(sql);

    if (isDelete && (!namedBinds.has('company') || (!namedBinds.has('plant') && !namedBinds.has('plantCd')))) {
      throw new ForbiddenException(
        'DELETE SQL은 company와 plant 또는 plantCd 테넌트 바인드를 포함해야 합니다.',
      );
    }

    if (Object.keys(tenantParams).length > 0) {
      params = { ...(params ?? {}), ...tenantParams };
    }

    this.logger.log(`SQL 실행: ${sql.substring(0, 100)}...`);

    // Oracle 바인드 파라미터 처리:
    // - 이름 바인드(:col_name) → params 객체를 그대로 전달 (oracledb가 직접 처리)
    // - 위치 바인드(:1, :2)   → Object.values() 배열로 전달
    // SQL에 `:숫자` 패턴이 없으면 이름 바인드로 판단
    // 문자열 리터럴/코멘트 내부의 `:숫자`는 매칭 대상에서 제외해야 false positive를 피할 수 있다.
    const sqlForBindScan = this.stripStringsAndComments(sql);
    const hasPositional = params && /:\d+/.test(sqlForBindScan);
    if (hasPositional) {
      this.assertSequentialPositionalBinds(sqlForBindScan);
    }
    const bindParams: Record<string, unknown> | unknown[] | undefined = params
      ? hasPositional
        ? Object.values(params)
        : params
      : undefined;
    const result = await (this.dataSource as SqlQueryDataSource).query(sql, bindParams);

    const affectedRows = Array.isArray(result) ? result.length : 0;

    return {
      success: true,
      affectedRows,
      message: `SQL 실행 완료 (${affectedRows}행)`,
    };
  }

  private extractNamedBinds(sql: string): Set<string> {
    const names = new Set<string>();
    for (const match of sql.matchAll(/:([A-Za-z][A-Za-z0-9_]*)/g)) {
      names.add(match[1]);
    }
    return names;
  }

  private extractTenantBindParams(namedBinds: Set<string>, job: SchedulerJob): Record<string, string> {
    const params: Record<string, string> = {};
    if (namedBinds.has('company')) params.company = job.company;
    if (namedBinds.has('plant')) params.plant = job.plantCd;
    if (namedBinds.has('plantCd')) params.plantCd = job.plantCd;
    return params;
  }

  private assertSequentialPositionalBinds(sanitizedSql: string): void {
    // 이름 문자열로 dedup. `:01`과 `:1`은 oracledb에서 별개 바인드라 Number 기반 dedup은 위험.
    const bindNames = new Set<string>();
    for (const match of sanitizedSql.matchAll(/:(\d+)/g)) {
      bindNames.add(match[1]);
    }
    const sorted = [...bindNames].sort((a, b) => Number(a) - Number(b));
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== String(i + 1)) {
        throw new BadRequestException(
          '위치 바인드(:숫자)는 :1부터 순차적으로 작성해야 합니다. 선행 0(:01) 또는 건너뛰기는 허용되지 않습니다.',
        );
      }
    }
  }

  /**
   * SQL에서 문자열 리터럴과 코멘트를 빈 문자열로 치환한다.
   * 바인드 스캔 시 리터럴 내부의 `:NN`(예: 'HH24:MI:SS')이 매칭되는 false positive를 막는다.
   */
  private stripStringsAndComments(sql: string): string {
    return sql
      // ' ... ' 문자열 리터럴 (Oracle 표준: 작은따옴표 두 개 '' 로 이스케이프)
      .replace(/'(?:''|[^'])*'/g, "''")
      // q'[...]' / q'(...)' / q'{...}' / q'<...>' Oracle quote literal
      .replace(/[qQ]'(.)([\s\S]*?)\1'/g, "''")
      // -- 라인 코멘트
      .replace(/--[^\n\r]*/g, '')
      // /* ... */ 블록 코멘트
      .replace(/\/\*[\s\S]*?\*\//g, '');
  }
}
