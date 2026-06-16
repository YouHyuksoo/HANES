import type { QueryRunner, Logger as TypeOrmLogger } from 'typeorm';
import { recordSqlDebugQuery } from './sql-debug-context';

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
    _time: number,
    _query: string,
    _parameters?: unknown[],
    _queryRunner?: QueryRunner,
  ): void {
    // Slow-query handling remains controlled by TypeORM maxQueryExecutionTime.
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
