/**
 * @file src/common/interceptors/logging.interceptor.ts
 * @description 요청/응답 로깅 인터셉터
 *
 * 초보자 가이드:
 * 1. **목적**: 모든 API 요청과 응답을 로깅
 * 2. **적용**: main.ts에서 app.useGlobalInterceptors()로 등록
 * 3. **정보**: 메서드, URL, 응답 시간, 상태 코드 등 기록
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    // 요청 시작 로그
    this.logger.log(
      `[REQ] ${method} ${url} - IP: ${ip} - User-Agent: ${userAgent.substring(0, 50)}`,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const { statusCode } = response;

          // 응답 완료 로그
          this.logger.log(
            `[RES] ${method} ${url} - ${statusCode} - ${duration}ms`,
          );
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;

          // 에러 발생 로그
          this.logger.error(
            `[ERR] ${method} ${url} - ${duration}ms - ${error.message}`,
          );
        },
      }),
    );
  }
}
