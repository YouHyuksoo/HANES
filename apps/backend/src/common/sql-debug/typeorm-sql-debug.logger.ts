import type { QueryRunner, Logger as TypeOrmLogger } from 'typeorm';
import { recordSqlDebugQuery } from './sql-debug-context';
import { requestMetricsStore } from '../metrics/request-metrics.store';

export class SqlDebugTypeormLogger implements TypeOrmLogger {
  logQuery(query: string, parameters?: unknown[], _queryRunner?: QueryRunner): void {
    recordSqlDebugQuery(query, parameters);
  }

  logQueryError(
    _error: string | Error,
    _query: string,
    _parameters?: unknown[],
    _queryRunner?: QueryRunner,
  ): void {
    // Query errors are already surfaced through Nest exception handling.
  }

  logQuerySlow(
    time: number,
    query: string,
    _parameters?: unknown[],
    _queryRunner?: QueryRunner,
  ): void {
    // maxQueryExecutionTime(3초) 초과 쿼리를 /system/health 느린 쿼리 표로 보낸다
    requestMetricsStore.recordSlowQuery(time, query);
  }

  logSchemaBuild(_message: string, _queryRunner?: QueryRunner): void {
    // Schema sync is disabled in this project.
  }

  logMigration(_message: string, _queryRunner?: QueryRunner): void {
    // Migration logging is not needed for request SQL capture.
  }

  log(_level: 'log' | 'info' | 'warn', _message: unknown, _queryRunner?: QueryRunner): void {
    // Keep console output quiet; this logger is for response debug metadata.
  }
}
