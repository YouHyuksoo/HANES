/**
 * @file common/interceptors/metrics.interceptor.ts
 * @description 요청 1건의 경로·상태·소요·쿼리 수·사용자를 RequestMetricsStore 에 남긴다(개발·운영 공통).
 *
 * main.ts 에서 SqlDebugInterceptor **뒤에** 등록해야 한다 — 그래야 그 요청의 AsyncLocalStorage 안에서
 * getSqlDebugQueries() 로 실행 쿼리 수를 읽을 수 있다. 로그를 찍지 않으므로 운영에서도 비용이 거의 없다.
 */
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { getSqlDebugQueries } from '../sql-debug/sql-debug-context';
import { getRequestUser, type RequestWithUser } from '../utils/request-user.util';
import { requestMetricsStore } from '../metrics/request-metrics.store';

/** express 라우트 패턴(/api/v1/xxx/:id) → /xxx/:id. 매칭 실패(404)면 실제 경로에서 숫자·긴 토큰을 :id 로 가린다 */
export function normalizeRoute(req: { route?: { path?: string }; baseUrl?: string; path?: string; originalUrl?: string }): string {
  const pattern = req.route?.path ? `${req.baseUrl ?? ''}${req.route.path}` : (req.path ?? req.originalUrl ?? '').split('?')[0];
  return pattern
    .replace(/^\/api\/v1/, '')
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    .replace(/\/[A-Za-z0-9_-]{20,}(?=\/|$)/g, '/:id') || '/';
}

/** Nest HttpException 처럼 getStatus() 를 가진 예외인지 — 캐스팅 없이 좁힌다 */
function hasHttpStatus(err: unknown): err is { getStatus: () => number } {
  return typeof err === 'object' && err !== null && typeof Reflect.get(err, 'getStatus') === 'function';
}

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<Request & RequestWithUser>();
    const res = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();
    const finish = (status: number, error?: string) => {
      requestMetricsStore.record({
        at: startedAt,
        method: (req.method ?? 'GET').toUpperCase(),
        route: normalizeRoute(req),
        status,
        ms: Date.now() - startedAt,
        queries: getSqlDebugQueries().length,
        userId: getRequestUser(req)?.id,
        ip: req.ip,
        error,
      });
    };
    return next.handle().pipe(
      tap({
        next: () => finish(res.statusCode ?? 200),
        error: (err: unknown) => {
          finish(hasHttpStatus(err) ? err.getStatus() : 500, err instanceof Error ? err.message : String(err));
        },
      }),
    );
  }
}
