import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  getSqlDebugQueries,
  runWithSqlDebugContext,
  type SqlDebugQuery,
} from '../sql-debug/sql-debug-context';

type ResponsePayload = Record<string, unknown>;

@Injectable()
export class SqlDebugInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ method?: string }>();
    const method = request.method?.toUpperCase();

    return new Observable((subscriber) =>
      runWithSqlDebugContext(() => {
        const subscription = next
          .handle()
          .pipe(map((payload) => attachSqlDebug(payload, method)))
          .subscribe(subscriber);

        return () => subscription.unsubscribe();
      }),
    );
  }
}

function attachSqlDebug(payload: unknown, method?: string): unknown {
  if (method !== 'GET') {
    return payload;
  }

  const queries = getSqlDebugQueries();
  if (queries.length === 0) {
    return payload;
  }

  const debugSql = buildDebugSql(queries);

  if (isResponsePayload(payload) && 'success' in payload) {
    return {
      ...payload,
      meta: {
        ...(isResponsePayload(payload.meta) ? payload.meta : {}),
        debugSql,
      },
    };
  }

  return {
    success: true,
    data: payload,
    meta: { debugSql },
    timestamp: new Date().toISOString(),
  };
}

function buildDebugSql(queries: SqlDebugQuery[]) {
  const representativeQuery =
    [...queries].reverse().find((query) => !isCountOnlySelect(query.sql)) ??
    queries[queries.length - 1];

  return {
    sql: representativeQuery?.sql,
    parameters: representativeQuery?.parameters,
    tables: representativeQuery?.tables ?? [],
    queries,
  };
}

function isResponsePayload(value: unknown): value is ResponsePayload {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isCountOnlySelect(sql: string): boolean {
  return /^\s*SELECT\s+COUNT\s*\(/i.test(sql);
}
