/**
 * @file src/common/filters/http-exception.filter.ts
 * @description 글로벌 HTTP 예외 필터 — Oracle DB 연결 오류 503 처리 포함
 *
 * 초보자 가이드:
 * 1. **목적**: 모든 HTTP 예외를 일관된 형식으로 변환
 * 2. **적용**: main.ts에서 app.useGlobalFilters()로 등록
 * 3. **DB 오류**: Oracle 연결 오류(NJS-500, NJS-510 등)는 503으로 반환
 * 4. **로깅**: 500/503 에러는 스택 트레이스 포함하여 로깅
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/** Oracle DB 연결 관련 에러 패턴 */
const DB_CONNECTION_PATTERNS = [
  'NJS-500',   // connection to the Oracle Database was broken
  'NJS-510',   // connection timed out
  'NJS-521',   // connection pool is closing/closed
  'ORA-03113', // end-of-file on communication channel
  'ORA-03114', // not connected to Oracle
  'ORA-03135', // connection lost contact
  'ORA-12170', // connect timeout
  'ORA-12541', // no listener
  'ORA-12543', // TNS: destination host unreachable
  'ORA-12514', // listener does not know of service
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'connection was destroyed',
  'Connection is not established',
];

interface ErrorResponse {
  success: boolean;
  message: string;
  errorCode: string;
  statusCode: number;
  timestamp: string;
  path: string;
  details?: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let errorCode: string;
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        errorCode = `HTTP_${status}`;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = (responseObj.message as string) || exception.message;
        errorCode = (responseObj.errorCode as string) || `HTTP_${status}`;
        details = responseObj.details;
      } else {
        message = exception.message;
        errorCode = `HTTP_${status}`;
      }
    } else if (exception instanceof Error) {
      // DB 연결 오류 감지 → 503 Service Unavailable
      if (this.isDbConnectionError(exception)) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = '데이터베이스 연결이 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요.';
        errorCode = 'DB_CONNECTION_ERROR';

        this.logger.error(
          `[DB 연결 오류] ${exception.message}`,
          exception.stack,
        );
      } else {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = '서버 내부 오류가 발생했습니다.';
        errorCode = 'INTERNAL_SERVER_ERROR';

        this.logger.error(
          `Unhandled exception: ${exception.message}`,
          exception.stack,
        );
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = '알 수 없는 오류가 발생했습니다.';
      errorCode = 'UNKNOWN_ERROR';
    }

    const errorResponse: ErrorResponse = {
      success: false,
      message,
      errorCode,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (details) {
      errorResponse.details = details;
    }

    this.logger.warn(
      `[${request.method}] ${request.url} - ${status} ${message}`,
    );

    response.status(status).json(errorResponse);
  }

  /** 에러 메시지에서 Oracle DB 연결 관련 패턴 매칭 */
  private isDbConnectionError(error: Error): boolean {
    const msg = error.message || '';
    const stack = error.stack || '';
    const combined = `${msg} ${stack}`;
    return DB_CONNECTION_PATTERNS.some((p) => combined.includes(p));
  }
}
